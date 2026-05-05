import type { MusicaCompleta, Playlist, PlaylistResponse } from '../types/webservice';

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

export function pickAmbientFromResponse(data: PlaylistResponse): Playlist | null {
  return pickAmbientPlaylist(data.playlists);
}
