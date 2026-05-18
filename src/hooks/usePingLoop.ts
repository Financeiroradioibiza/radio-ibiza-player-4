import { useEffect, useRef } from 'react';
import * as ws from '../api/webservice';
import { IBIZA_SHELL_VERSION, LIMITES } from '../api/config';
import { useAppStore } from '../store/app';
import { storage } from '../storage';
import { fetchProgramacao } from './fetchProgramacao';
import { pingMarcacao } from '../player/pingMarcacao';
import { verificarAtualizacaoShell } from '../player/appShellUpdate';
import { syncCachedDownloadsReportToServer } from '../player/downloadReport';
import { fetchAvisosOperadorParaPdv } from '../api/playerAvisos';

async function drainPendingExecutions(token: string): Promise<void> {
  const pend = await storage.listarExecucoesPendentes(80);
  for (const ex of pend) {
    if (ex.id === undefined) continue;
    try {
      await ws.saveExecutada({
        token,
        playlists_musica_id: ex.playlists_musica_id,
        data_execucao: ex.data_execucao,
        ind_termino: ex.ind_termino === 1 ? 1 : 0,
      });
      await storage.removerExecucao(ex.id);
    } catch {
      await storage.incrementarTentativaExecucao(ex.id);
      break;
    }
  }
}

/**
 * Ping periódico (TIME_TO_PING_MIN) mais um ping imediato ao entrar na tela Player com token.
 * O painel só mostra versão/MAC/IP e primeiro ping depois deste GET; atualiza também PDV/fila save_executadas.
 */
export function usePingLoop() {
  const tokenRec = useAppStore((s) => s.token);
  /** Evita interval duplicado em re-renders / Strict Mode */
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const tok = tokenRec?.token;
    if (!tok) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);

    const ms = LIMITES.TIME_TO_PING_MIN * 60 * 1000;
    /** Evita dois `run` paralelos (interval + online + imediato). */
    let runEmAndamento = false;
    /**
     * A primeira chamada (`run` imediato ao montar) não deve contar como “falha por offline”
     * — só a partir dos ciclos seguintes (intervalo / `online`) exigimos conexão.
     */
    let primeiraVezPing = true;

    const run = async () => {
      if (runEmAndamento) return;
      const { token } = useAppStore.getState();
      const tokenStr = token?.token;
      if (!tokenStr) return;

      const ignorarPenalidadeOffline = primeiraVezPing;
      primeiraVezPing = false;

      /**
       * Sem rede = o servidor não foi contactado — conta como falha de sincronização
       * (política: máximo 3 dias sem ping bem-sucedido; ver `LIMIT_TIMES_PING_OFF`).
       */
      if (!navigator.onLine) {
        if (!ignorarPenalidadeOffline) {
          await useAppStore.getState().incrementarPingFalho();
        }
        return;
      }

      /** Fechar o PWA/aba durante o `fetch` do ping aborta o request — não conta como falha de servidor. */
      let encerrandoPagina = false;
      const onPageHide = () => {
        encerrandoPagina = true;
      };

      runEmAndamento = true;
      const flagMarcacao = pingMarcacao.flagsParaProximoPing();

      try {
        window.addEventListener('pagehide', onPageHide);

        const raw = await ws.ping({
          token: tokenStr,
          pdv_atualizado: flagMarcacao,
        });

        const parsed = ws.parsePingResponse(raw);

        if (parsed.kind === 'token_invalido') {
          await useAppStore.getState().logout();
          return;
        }

        if (parsed.kind !== 'ok') {
          console.error('[ping]', parsed.detail);
          await useAppStore.getState().incrementarPingFalho();
          return;
        }

        pingMarcacao.registrarPingSucessoComFlag(flagMarcacao);

        await useAppStore.getState().atualizarPdv(parsed.pdv);
        await useAppStore.getState().resetarPings();

        const st = useAppStore.getState();
        void fetchAvisosOperadorParaPdv(st.cliente_id, st.pdv?.id, tokenStr).then((msgs) => {
          useAppStore.getState().setAvisosOperadorMensagens(msgs);
        });

        await drainPendingExecutions(tokenStr);

        /** Barra «% baixado» no painel: POST /save_atualizadas/ com ids de música após programa alinhada. */
        await syncCachedDownloadsReportToServer();

        if (
          parsed.pdv.atualizacao_pendente === 'S' ||
          parsed.pdv.atualizacao_pendente_agenda === 'S'
        ) {
          const pack = await fetchProgramacao(tokenStr);
          if (pack.ok) {
            await useAppStore.getState().salvarPlaylist(pack.playlist);
            await useAppStore.getState().salvarAgendas(pack.agendas);
            pingMarcacao.aposBaixarConteudo();
            /** Programação mudou → mapear de novo caches antigos antes do próximo ping. */
            await syncCachedDownloadsReportToServer();
          }
        }

        void verificarAtualizacaoShell({ versaoLocal: IBIZA_SHELL_VERSION, motivo: 'ping' });
      } catch (e) {
        if (encerrandoPagina) {
          //
        } else {
          console.error('[ping]', e);
          await useAppStore.getState().incrementarPingFalho();
        }
      } finally {
        window.removeEventListener('pagehide', onPageHide);
        runEmAndamento = false;
      }
    };

    const onOnline = () => void run();

    intervalRef.current = setInterval(() => void run(), ms);
    window.addEventListener('online', onOnline);

    /* O painel lê versão do player / 1º ping a partir deste endpoint; só `save_executadas`
     * não popula esses campos — sem isto ficava tudo em branco até passar TIME_TO_PING_MIN. */
    void run();

    return () => {
      window.removeEventListener('online', onOnline);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tokenRec?.token]);
}
