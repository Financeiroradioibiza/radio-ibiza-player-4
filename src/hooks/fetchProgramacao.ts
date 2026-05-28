import * as ws from '../api/webservice';
import {
  coerceAgendasList,
  coercePlaylistResponse,
  filtrarAgendasAoPrograma,
  mergeAgendasPorId,
  mergePlaylistsPlaylistComVinhetas,
  restringirPacoteAsPlaylistsPrimarias,
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

/** Evita duas leituras paralelas (ping + ATL) sobrescreverem `programacaoPendente`. */
let fetchProgramacaoMutex: Promise<void> = Promise.resolve();

async function withFetchProgramacaoMutex<T>(fn: () => Promise<T>): Promise<T> {
  const anterior = fetchProgramacaoMutex;
  let libertar!: () => void;
  fetchProgramacaoMutex = new Promise<void>((resolve) => {
    libertar = resolve;
  });
  await anterior;
  try {
    return await fn();
  } finally {
    libertar();
  }
}

/**
 * Monta o pacote de programação **destinado a este PDV** a partir do webservice.
 *
 * Regra: `/playlist/` define quais pastas existem; `/agendas/` (+ cadência em
 * `/vinhetas_*`) só complementam pastas já listadas — nunca injectam grade antiga.
 */
async function fetchProgramacaoInterno(token: string): Promise<FetchProgramacaoResult> {
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

  const primarias = pl.data.playlists;
  const primariaIds = new Set(
    primarias.map((p) => Math.trunc(Number(p.id))).filter((id) => id > 0),
  );
  const programaId = pl.data.programa?.id;

  const agendasBase = filtrarAgendasAoPrograma(
    coerceAgendasList(agendasRaw),
    programaId,
    primariaIds,
  );
  const agendasVinProg =
    vinProgRaw != null
      ? filtrarAgendasAoPrograma(coerceAgendasList(vinProgRaw), programaId, primariaIds)
      : [];
  const agendasVinAgen =
    vinAgenRaw != null
      ? filtrarAgendasAoPrograma(coerceAgendasList(vinAgenRaw), programaId, primariaIds)
      : [];
  const agendasMerged = mergeAgendasPorId(agendasBase, agendasVinProg, agendasVinAgen);

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
  const pacote = restringirPacoteAsPlaylistsPrimarias(
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

/**
 * Baixa `/playlist/`, `/agendas/`, `/vinhetas_programadas/` e `/vinhetas_agendadas/` em paralelo
 * (como o fluxo documentado no protocolo legado) e unifica listas — o painel pode mandar
 * cronograma de vinhetas ou chaves alternativas só nesses GETs.
 */
export async function fetchProgramacao(token: string): Promise<FetchProgramacaoResult> {
  return withFetchProgramacaoMutex(() => fetchProgramacaoInterno(token));
}
