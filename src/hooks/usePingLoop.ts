import { useEffect, useRef } from 'react';
import * as ws from '../api/webservice';
import { LIMITES } from '../api/config';
import { useAppStore } from '../store/app';
import { storage } from '../storage';
import { fetchProgramacao } from './fetchProgramacao';
import { pingMarcacao } from '../player/pingMarcacao';
import { syncCachedDownloadsReportToServer } from '../player/downloadReport';

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

    const run = async () => {
      if (runEmAndamento) return;
      const { token } = useAppStore.getState();
      const tokenStr = token?.token;
      if (!tokenStr) return;

      /**
       * Sem rede não é “servidor inacessível” — não acumula `ping_times`.
       * Do contrário, Wi‑Fi instável / PC dormindo à noite desativava o player no limite 540.
       */
      if (!navigator.onLine) {
        return;
      }

      runEmAndamento = true;
      const flagMarcacao = pingMarcacao.flagsParaProximoPing();

      try {
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
      } catch (e) {
        console.error('[ping]', e);
        await useAppStore.getState().incrementarPingFalho();
      } finally {
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
