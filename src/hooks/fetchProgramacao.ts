import * as ws from '../api/webservice';
import {
  coerceAgendasList,
  coercePlaylistResponse,
  mergeAgendasPorId,
  mergePlaylistsPlaylistComVinhetas,
} from '../api/coerceProgramacao';
import type { Agenda, PlaylistResponse } from '../types/webservice';

export type FetchProgramacaoResult =
  | { ok: true; playlist: PlaylistResponse; agendas: Agenda[] }
  | { ok: false; error: string };

/**
 * Baixa `/playlist/`, `/agendas/`, `/vinhetas_programadas/` e `/vinhetas_agendadas/` em paralelo
 * (como o fluxo documentado no protocolo legado) e unifica listas — o painel pode mandar
 * cronograma de vinhetas ou chaves alternativas só nesses GETs.
 */
export async function fetchProgramacao(token: string): Promise<FetchProgramacaoResult> {
  const [playlistRaw, agendasRaw, vinProgRaw, vinAgenRaw] = await Promise.all([
    ws.getPlaylist(token),
    ws.getAgendas(token),
    ws.getVinhetasProgramadas(token).catch(() => null),
    ws.getVinhetasAgendadas(token).catch(() => null),
  ]);

  const pl = coercePlaylistResponse(playlistRaw);
  if (!pl.ok) {
    return { ok: false, error: pl.error };
  }

  const agendasBase = coerceAgendasList(agendasRaw);
  const agendasVinProg = vinProgRaw != null ? coerceAgendasList(vinProgRaw) : [];
  const agendasVinAgen = vinAgenRaw != null ? coerceAgendasList(vinAgenRaw) : [];
  const agendas = mergeAgendasPorId(agendasBase, agendasVinProg, agendasVinAgen);

  const extrasPacks: PlaylistResponse[] = [];
  if (vinProgRaw != null) {
    const v = coercePlaylistResponse(vinProgRaw);
    if (v.ok) extrasPacks.push(v.data);
  }
  if (vinAgenRaw != null) {
    const v = coercePlaylistResponse(vinAgenRaw);
    if (v.ok) extrasPacks.push(v.data);
  }

  const playlists = mergePlaylistsPlaylistComVinhetas(pl.data.playlists, extrasPacks);

  return {
    ok: true,
    playlist: { ...pl.data, playlists },
    agendas,
  };
}
