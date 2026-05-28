/**
 * Um ciclo completo de `/ping/` + efeitos colaterais (PDV, fila, avisos, programação pendente).
 * Usado pelo intervalo do `usePingLoop` e pelo alinhamento inicial antes do primeiro play.
 */

import * as ws from '@/api/webservice';
import { useAppStore } from '@/store/app';
import { storage } from '@/storage';
import { fetchProgramacao } from '@/hooks/fetchProgramacao';
import { pingMarcacao } from '@/player/pingMarcacao';
import { shellUpdateContextFromLocation, verificarAtualizacaoShell } from '@/player/appShellUpdate';
import { syncCachedDownloadsReportToServer } from '@/player/downloadReport';
import { aplicarProgramacaoDoPing } from '@/player/programacaoRefresh';
import { fetchAvisosOperadorParaPdv } from '@/api/playerAvisos';

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

export type ResultadoCicloPing = 'ok' | 'logout' | 'erro_rede';

export interface ExecutarCicloPingParams {
  token: string;
  pdvAtualizadoFlag: 0 | 1;
}

/**
 * Executa ping + atualização opcional de programação. Não altera `status` do store
 * (só `logout` em token inválido).
 */
export async function executarCicloPing({
  token,
  pdvAtualizadoFlag,
}: ExecutarCicloPingParams): Promise<ResultadoCicloPing> {
  let encerrandoPagina = false;
  const onPageHide = () => {
    encerrandoPagina = true;
  };

  try {
    window.addEventListener('pagehide', onPageHide);

    const raw = await ws.ping({
      token,
      pdv_atualizado: pdvAtualizadoFlag,
    });

    const parsed = ws.parsePingResponse(raw);

    if (parsed.kind === 'token_invalido') {
      await useAppStore.getState().logout();
      return 'logout';
    }

    if (parsed.kind !== 'ok') {
      console.error('[ping]', parsed.detail);
      await useAppStore.getState().incrementarPingFalho();
      return 'erro_rede';
    }

    pingMarcacao.registrarPingSucessoComFlag(pdvAtualizadoFlag);

    await useAppStore.getState().atualizarPdv(parsed.pdv);
    await useAppStore.getState().resetarPings();

    const st = useAppStore.getState();
    void fetchAvisosOperadorParaPdv(st.cliente_id, st.pdv?.id, token).then((msgs) => {
      useAppStore.getState().setAvisosOperadorMensagens(msgs);
    });

    await drainPendingExecutions(token);

    await syncCachedDownloadsReportToServer();

    if (
      parsed.pdv.atualizacao_pendente === 'S' ||
      parsed.pdv.atualizacao_pendente_agenda === 'S'
    ) {
      const pack = await fetchProgramacao(token);
      if (pack.ok) {
        await aplicarProgramacaoDoPing(pack.playlist, pack.agendas);
        pingMarcacao.aposBaixarConteudo();
        await syncCachedDownloadsReportToServer();
      }
    }

    const ctx = shellUpdateContextFromLocation();
    void verificarAtualizacaoShell({ ...ctx, motivo: 'ping' });
    return 'ok';
  } catch (e) {
    if (encerrandoPagina) {
      return 'ok';
    }
    console.error('[ping]', e);
    await useAppStore.getState().incrementarPingFalho();
    return 'erro_rede';
  } finally {
    window.removeEventListener('pagehide', onPageHide);
  }
}
