import * as ws from '../api/webservice';
import { coerceAgendasList, coercePlaylistResponse } from '../api/coerceProgramacao';
import type { Agenda, PlaylistResponse } from '../types/webservice';

export type FetchProgramacaoResult =
  | { ok: true; playlist: PlaylistResponse; agendas: Agenda[] }
  | { ok: false; error: string };

/** Baixa /playlist/ e /agendas/ e valida; não altera store. */
export async function fetchProgramacao(token: string): Promise<FetchProgramacaoResult> {
  const [playlistRaw, agendasRaw] = await Promise.all([
    ws.getPlaylist(token),
    ws.getAgendas(token),
  ]);
  const pl = coercePlaylistResponse(playlistRaw);
  if (!pl.ok) {
    return { ok: false, error: pl.error };
  }
  return {
    ok: true,
    playlist: pl.data,
    agendas: coerceAgendasList(agendasRaw),
  };
}
