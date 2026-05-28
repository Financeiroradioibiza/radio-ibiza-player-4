/**
 * Baixa programação (`/playlist/` + `/agendas/` + vinhetas), guarda em memória como «pendente» e só aplica à persistência/store
 * quando o loop chama `consumirProgramacaoPendente` — assim a faixa atual não é interrompida.
 */

import { fetchProgramacao } from '@/hooks/fetchProgramacao';
import { parsePingResponse, ping } from '@/api/webservice';
import { useAppStore } from '@/store/app';
import { pingMarcacao } from '@/player/pingMarcacao';
import { syncCachedDownloadsReportToServer } from '@/player/downloadReport';
import { programacaoEspelhoDoStore } from '@/player/atlSupport';
import {
  collectPrefetchItems,
  prefetchProgramacaoCompleta,
} from '@/player/cacheManager';
import { limparEstadoVinhetasPersistido } from '@/player/vinhetas';
import { expurgarCacheAudioForaPrograma } from '@/player/programacaoCache';
import type { Agenda, PlaylistResponse } from '@/types/webservice';

export type SolicitarRefreshResult =
  | { ok: true }
  | { ok: false; error: string; tokenInvalidated?: boolean };

export type AtlOrigemChamada = 'manual' | 'auto';

export interface SolicitarAtualizacaoOpcoes {
  /** `manual`: botão ATL (sempre enfileira programação nova). `auto`: até 3×/dia — só pendente se programação/agendas mudarem. */
  origem?: AtlOrigemChamada;
}

let fetchEmAndamento: Promise<SolicitarRefreshResult> | null = null;

let prefetchJob: {
  cancel: () => void;
  done: Promise<void>;
} | null = null;

function cancelarPrefetchEmCurso(): void {
  prefetchJob?.cancel();
  prefetchJob = null;
}

/** Cancela prefetch em curso (ex.: logout). */
export function cancelarPrefetchProgramacaoEmBackground(): void {
  cancelarPrefetchEmCurso();
  useAppStore.setState({ prefetchProgramacaoProgress: null });
}

/**
 * Pré-baixa todas as faixas do pacote (como na 1.ª instalação) enquanto a faixa actual ainda toca.
 * Actualiza `prefetchProgramacaoProgress` no store para a UI.
 */
export function iniciarPrefetchProgramacaoEmBackground(playlist: PlaylistResponse): Promise<void> {
  cancelarPrefetchEmCurso();

  const items = collectPrefetchItems(playlist);
  if (items.length === 0) {
    useAppStore.setState({ prefetchProgramacaoProgress: null });
    return Promise.resolve();
  }

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  const done = (async () => {
    useAppStore.setState({ prefetchProgramacaoProgress: { done: 0, total: items.length } });
    try {
      await prefetchProgramacaoCompleta(items, (doneCount, total) => {
        if (!cancelled) {
          useAppStore.setState({ prefetchProgramacaoProgress: { done: doneCount, total } });
        }
      });
      if (!cancelled) {
        await syncCachedDownloadsReportToServer();
      }
    } catch (e) {
      console.error('[prefetch-programacao]', e);
    } finally {
      if (!cancelled) {
        useAppStore.setState({ prefetchProgramacaoProgress: null });
      }
    }
  })();

  prefetchJob = { cancel, done };
  return done.finally(() => {
    if (prefetchJob?.done === done) prefetchJob = null;
  });
}

/** Espera o prefetch iniciado por ATL/ping terminar (no-op se não houver). */
export async function aguardarPrefetchProgramacaoEmCurso(): Promise<void> {
  if (prefetchJob) await prefetchJob.done;
}

/** Enfileira programação nova + dispara prefetch em massa (ATL manual/auto e ping). */
export function enfileirarProgramacaoPendenteComPrefetch(
  playlist: PlaylistResponse,
  agendas: Agenda[],
): void {
  useAppStore.setState({
    programacaoPendente: { playlist, agendas },
  });
  void iniciarPrefetchProgramacaoEmBackground(playlist);
}

/** Atualiza no store `status`, permissões (placa, player, playlists) e flags vindas do `/ping/`. */
async function sincronizarSnapshotPdvPorPing(tokenStr: string): Promise<'ok' | 'token_invalido'> {
  try {
    const raw = await ping({ token: tokenStr });
    const parsed = parsePingResponse(raw);
    if (parsed.kind === 'token_invalido') return 'token_invalido';
    if (parsed.kind !== 'ok') return 'ok';
    await useAppStore.getState().atualizarPdv(parsed.pdv);
    await useAppStore.getState().resetarPings();
    return 'ok';
  } catch (e) {
    console.error('[atl] ping pdv', e);
    return 'ok';
  }
}

function mensagemAmigavel(codigo: string): string {
  const map: Record<string, string> = {
    token_invalido: 'Sessão inválida.',
    playlists_ausentes: 'Servidor não retornou playlists para este PDV.',
    resposta_invalida: 'Resposta inválida do servidor.',
  };
  return map[codigo] ?? codigo.replace(/_/g, ' ');
}

/**
 * Obtém novo pacote na nuvem e substitui qualquer pendente anterior.
 * Não altera áudio/store ativo até `consumirProgramacaoPendente` na troca de faixa.
 * Sempre consulta `/ping/` antes para alinhar permissões e status do PDV com o webservice.
 */
export async function solicitarAtualizacaoProgramacaoNuvem(
  opcoes?: SolicitarAtualizacaoOpcoes,
): Promise<SolicitarRefreshResult> {
  if (fetchEmAndamento) return fetchEmAndamento;

  const origem = opcoes?.origem ?? 'manual';

  fetchEmAndamento = (async (): Promise<SolicitarRefreshResult> => {
    const token = useAppStore.getState().token?.token;
    if (!token) return { ok: false, error: 'Sem sessão ativa.' };
    if (!navigator.onLine) return { ok: false, error: 'Sem conexão à internet.' };

    try {
      const pingRes = await sincronizarSnapshotPdvPorPing(token);
      if (pingRes === 'token_invalido') {
        await useAppStore.getState().logout();
        return { ok: false, error: 'Sessão inválida. Entre novamente.', tokenInvalidated: true };
      }

      const pack = await fetchProgramacao(token);
      if (!pack.ok) {
        if (pack.error === 'token_invalido') {
          await useAppStore.getState().logout();
          return { ok: false, error: 'Sessão inválida. Entre novamente.', tokenInvalidated: true };
        }
        return { ok: false, error: mensagemAmigavel(pack.error) };
      }

      const state = useAppStore.getState();
      const espelho =
        origem === 'auto' &&
        programacaoEspelhoDoStore(pack.playlist, pack.agendas, state.playlistData, state.agendas);

      if (origem === 'manual' || !espelho) {
        enfileirarProgramacaoPendenteComPrefetch(pack.playlist, pack.agendas);
      }

      const snap = useAppStore.getState();
      if (snap.pdv?.status === 'I') {
        useAppStore.setState({ status: 'desativado' });
      }

      return { ok: true };
    } catch (e) {
      console.error(e);
      return { ok: false, error: 'Falha ao contactar o servidor.' };
    } finally {
      fetchEmAndamento = null;
    }
  })();

  return fetchEmAndamento;
}

/** Aplica pacote pendente ao storage + store sem reset destrutivo da faixa (ver loop). */
export async function consumirProgramacaoPendente(): Promise<{
  playlist: PlaylistResponse;
  agendas: Agenda[];
} | null> {
  const st = useAppStore.getState();
  const p = st.programacaoPendente;
  if (!p) return null;

  useAppStore.setState({ skipDestructivePlaylistReload: true });
  try {
    await st.salvarProgramacaoCompleta(p.playlist, p.agendas);
    useAppStore.setState({ programacaoPendente: null });

    limparEstadoVinhetasPersistido();
    await expurgarCacheAudioForaPrograma(p.playlist);

    await aguardarPrefetchProgramacaoEmCurso();
    pingMarcacao.aposBaixarConteudo();
    await syncCachedDownloadsReportToServer();

    useAppStore.setState((s) => ({
      programacaoTrocaEpoch: s.programacaoTrocaEpoch + 1,
    }));

    return { playlist: p.playlist, agendas: p.agendas };
  } catch (e) {
    console.error(e);
    useAppStore.setState({ skipDestructivePlaylistReload: false });
    return null;
  }
}

/** Ping com `atualizacao_pendente`: enfileira troca + prefetch ou só refresca metadados se espelho. */
export async function aplicarProgramacaoDoPing(
  playlist: PlaylistResponse,
  agendas: Agenda[],
): Promise<void> {
  const snap = useAppStore.getState();
  const mesmaProgramacaoNaMemoria = programacaoEspelhoDoStore(
    playlist,
    agendas,
    snap.playlistData,
    snap.agendas,
  );

  if (mesmaProgramacaoNaMemoria) {
    await snap.salvarProgramacaoCompleta(playlist, agendas, { preservePlayback: true });
    return;
  }

  enfileirarProgramacaoPendenteComPrefetch(playlist, agendas);
}
