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
        useAppStore.setState({
          programacaoPendente: { playlist: pack.playlist, agendas: pack.agendas },
        });
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
    await st.salvarPlaylist(p.playlist);
    await st.salvarAgendas(p.agendas);
    useAppStore.setState({ programacaoPendente: null });
    pingMarcacao.aposBaixarConteudo();
    await syncCachedDownloadsReportToServer();
    return { playlist: p.playlist, agendas: p.agendas };
  } catch (e) {
    console.error(e);
    useAppStore.setState({ skipDestructivePlaylistReload: false });
    return null;
  }
}
