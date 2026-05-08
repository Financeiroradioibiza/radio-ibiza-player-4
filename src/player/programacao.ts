import type { Agenda, MusicaCompleta, Playlist, PlaylistResponse } from '../types/webservice';
import {
  agendaCabeNoDiaSemana,
  dentroIntervaloHorasAgenda,
  extrairSomenteDataYmd,
  mesmoDiaAgenda,
  parseHoraParaMinutosDia,
} from './vinhetas';

/** Regra de slot para pastas tipo N: data civil (`data_agendada`), dia da semana, janela horária; `data_fim` encerra campanha. */
function agendaAtivaParaSlotAmbiente(a: Agenda, now: Date): boolean {
  if (!mesmoDiaAgenda(a, now)) return false;
  if (!agendaCabeNoDiaSemana(a, now)) return false;
  if (!dentroIntervaloHorasAgenda(a, now)) return false;
  const fim = extrairSomenteDataYmd(a.data_fim ?? undefined);
  if (fim) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const today = `${y}-${m}-${d}`;
    if (today > fim) return false;
  }
  return true;
}

/**
 * Entre agendas que caem no slot atual, o maior `hora_inicio` desempata o limite compartilhado
 * (ex.: 12:00 está em 00:00–12:00 e em 12:00–23:59 — vale a janela que começa às 12:00).
 */
function maiorHoraInicioAgendaAtivaParaPlaylist(
  playlistId: number,
  agendas: Agenda[],
  now: Date,
): number {
  let max = -1;
  for (const a of agendas) {
    if (Number(a.playlist_id) !== playlistId) continue;
    if (!agendaAtivaParaSlotAmbiente(a, now)) continue;
    const m = parseHoraParaMinutosDia(a.hora_inicio || '00:00:00');
    if (m > max) max = m;
  }
  return max;
}

/** Primeira playlist normal (N) com pelo menos uma música e URL de áudio. */
export function pickAmbientPlaylist(playlists: Playlist[]): Playlist | null {
  for (const p of playlists) {
    if (String(p.tipo).toUpperCase() !== 'N') continue;
    if (!p.musicas?.length) continue;
    if (p.musicas.some((m) => m.url_musica)) return p;
  }
  return null;
}

/** Sorteia uma faixa da playlist ambiente (comportamento alinhado ao AS3). */
export function pickRandomTrack(playlist: Playlist): MusicaCompleta | null {
  const comUrl = playlist.musicas.filter((m) => m.url_musica);
  if (comUrl.length === 0) return null;
  const i = Math.floor(Math.random() * comUrl.length);
  return comUrl[i] ?? null;
}

/**
 * Como `pickRandomTrack`, mas evita repetir o id da música que está tocando (quando há outra opção).
 */
export function pickRandomTrackExcluding(
  playlist: Playlist,
  excludeMusicaId?: number,
): MusicaCompleta | null {
  let comUrl = playlist.musicas.filter((m) => m.url_musica);
  if (excludeMusicaId !== undefined && Number.isFinite(excludeMusicaId)) {
    const other = comUrl.filter((m) => Number(m.musica.id) !== excludeMusicaId);
    if (other.length > 0) comUrl = other;
  }
  if (comUrl.length === 0) return null;
  const i = Math.floor(Math.random() * comUrl.length);
  return comUrl[i] ?? null;
}

/** Converte `duracao` do webservice (`HH:mm:ss`, `mm:ss` ou segundos) em segundos. */
export function parseDuracaoRelogio(seg: string): number {
  const s = seg.trim();
  if (!s) return 0;
  const parts = s.split(':').map((p) => Number(String(p).trim()));
  if (parts.length > 0 && parts.every((x) => Number.isFinite(x))) {
    if (parts.length >= 3) {
      const [h = 0, m = 0, sec = 0] = parts;
      return h * 3600 + m * 60 + sec;
    }
    if (parts.length === 2) {
      const [m = 0, sec = 0] = parts;
      return m * 60 + sec;
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Primeira faixa com URL — vinhetas costumam ter uma música principal. */
export function pickVinhetaTrack(playlist: Playlist): MusicaCompleta | null {
  const xs = playlist.musicas?.filter((m) => m.url_musica) ?? [];
  return xs.length ? xs[Math.floor(Math.random() * xs.length)]! : null;
}

export function pickAmbientFromResponse(
  data: PlaylistResponse,
  agendas?: Agenda[] | null,
  now: Date = new Date(),
): Playlist | null {
  return pickAmbientPlaylistForCurrentSlot(data.playlists, agendas, now);
}

/**
 * Escolhe a pasta ambiente (tipo N) ativa **neste instante** conforme `/agendas/`:
 * prioriza playlists com linha no dia/hora atual; se **várias** caem no mesmo minuto
 * (ex.: fim 12:00 de uma e início 12:00 de outra), fica a de **maior** `hora_inicio`;
 * senão «tocar sempre»; por fim a primeira tipo N.
 */
export function pickAmbientPlaylistForCurrentSlot(
  playlists: Playlist[],
  agendas: Agenda[] | null | undefined,
  now: Date,
): Playlist | null {
  const ambientes = playlists.filter(
    (p) =>
      String(p.tipo).toUpperCase() === 'N' &&
      (p.musicas?.some((m) => Boolean(m.url_musica?.trim())) ?? false),
  );
  if (ambientes.length === 0) return null;

  const ag = agendas ?? [];
  const noSlot: Playlist[] = [];

  for (const pl of ambientes) {
    const rel = ag.filter((a) => Number(a.playlist_id) === pl.id);
    if (rel.length === 0) continue;
    const cabe = rel.some((a) => agendaAtivaParaSlotAmbiente(a, now));
    if (cabe) noSlot.push(pl);
  }

  if (noSlot.length > 0) {
    if (noSlot.length === 1) return noSlot[0]!;
    noSlot.sort((a, b) => {
      const mb = maiorHoraInicioAgendaAtivaParaPlaylist(b.id, ag, now);
      const ma = maiorHoraInicioAgendaAtivaParaPlaylist(a.id, ag, now);
      if (mb !== ma) return mb - ma;
      return a.id - b.id;
    });
    return noSlot[0]!;
  }

  const sempre = ambientes.find((p) => String(p.tocar_sempre).toUpperCase() === 'S');
  if (sempre) return sempre;

  return ambientes[0] ?? null;
}
