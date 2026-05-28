import * as ws from '../api/webservice';
import {
  coerceAgendasList,
  coercePlaylistResponse,
  filtrarVinhetasOrfasDoPacote,
  mergeAgendasPorId,
  mergePlaylistsPlaylistComVinhetas,
} from '../api/coerceProgramacao';
import type { Agenda, PlaylistResponse, TipoPlaylist } from '../types/webservice';

/**
 * Os endpoints `/vinhetas_programadas/` e `/vinhetas_agendadas/` raramente devolvem
 * o campo `tipo` na playlist — marcamos manualmente pra que o merge ainda enxergue
 * como VP/VA (sem isto a cadência `tocar_cada` que vem aí pode ser perdida).
 */
function forcarTipoEmPack(pack: PlaylistResponse, tipo: TipoPlaylist): PlaylistResponse {
  return {
    ...pack,
    playlists: pack.playlists.map((pl) => ({ ...pl, tipo })),
  };
}

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
  const agendasMerged = mergeAgendasPorId(agendasBase, agendasVinProg, agendasVinAgen);

  const primarias = pl.data.playlists;
  const primariaIds = new Set(
    primarias.map((p) => Math.trunc(Number(p.id))).filter((id) => id > 0),
  );

  const extrasPacks: PlaylistResponse[] = [];
  if (vinProgRaw != null) {
    const v = coercePlaylistResponse(vinProgRaw);
    if (v.ok) extrasPacks.push(forcarTipoEmPack(v.data, 'VP'));
  }
  if (vinAgenRaw != null) {
    const v = coercePlaylistResponse(vinAgenRaw);
    if (v.ok) extrasPacks.push(forcarTipoEmPack(v.data, 'VA'));
  }

  const playlistsMerged = mergePlaylistsPlaylistComVinhetas(primarias, extrasPacks);
  const pacote = filtrarVinhetasOrfasDoPacote(
    { ...pl.data, playlists: playlistsMerged },
    agendasMerged,
    primariaIds,
  );

  return {
    ok: true,
    playlist: pacote.playlist,
    agendas: pacote.agendas,
  };
}
