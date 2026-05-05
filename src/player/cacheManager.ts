/**
 * Download e leitura de MP3 no navegador:
 * - Cache Storage (via `storage.salvarAudio` / `obterAudioUrl`)
 * - IndexedDB: metadados em `registrarMusicaCacheada`
 *
 * Se `fetch` falhar (CORS, rede), devolve a URL remota para o <audio> tentar stream direto.
 */

import { redeTrace } from '../debug/redeDiag';
import { storage } from '../storage';
import { playbackUrlForAudioElement } from '../utils/audioUrl';
import type { MusicaCompleta, Playlist } from '../types/webservice';
import { queueDownloadReportForServer } from './downloadReport';

const DOWNLOAD_TIMEOUT_MS = 120_000;

/** Mesma convenção de `IndexedDBStorage.cacheKey` (PWA). */
export function virtualCacheKeyForMusica(musicaId: number): string {
  return `https://radio-ibiza.local/audio/${musicaId}.mp3`;
}

function musicaId(mc: MusicaCompleta): number {
  const n = Number(mc.musica.id);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Garante URL reproduzível: blob local se já cacheada ou se o download funcionar;
 * senão a URL remota do webservice.
 */
export async function ensurePlaybackUrl(
  faixa: MusicaCompleta,
  playlistId: number,
): Promise<string> {
  const mid = musicaId(faixa);
  const remote = playbackUrlForAudioElement(faixa.url_musica);
  if (!mid || !remote) return remote;

  try {
    const cached = await storage.obterAudioUrl(mid);
    if (cached) return cached;
  } catch {
    // APIs de storage indisponíveis — segue pro remoto
  }

  if (!navigator.onLine) {
    return remote;
  }

  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), DOWNLOAD_TIMEOUT_MS);
    const t0 = performance.now();
    const resp = await fetch(remote, {
      mode: 'cors',
      credentials: 'omit',
      signal: ctl.signal,
    });
    window.clearTimeout(t);
    const ms = Math.round(performance.now() - t0);

    let label = remote;
    try {
      const u = new URL(remote);
      label = `${u.hostname}${u.pathname}`;
    } catch {
      /* URL inválido */
    }
    redeTrace('ibiza-rede-audio', 'info', 'GET', label, resp.status, `${ms}ms`, `(id=${mid})`);

    if (!resp.ok) return remote;

    const blob = await resp.blob();
    if (blob.size === 0) return remote;

    await storage.salvarAudio(mid, blob);
    await storage.registrarMusicaCacheada({
      musica_id: mid,
      playlist_id: playlistId,
      nome_arquivo: faixa.musica.nome_arquivo,
      tamanho_bytes: blob.size,
      baixada_em: new Date().toISOString(),
      cache_key: virtualCacheKeyForMusica(mid),
    });

    queueDownloadReportForServer(mid);

    const fromCache = await storage.obterAudioUrl(mid);
    return fromCache ?? remote;
  } catch (e) {
    const why =
      e instanceof Error ? e.message.slice(0, 180) : String(e).slice(0, 180);
    redeTrace(
      'ibiza-rede-audio',
      'warn',
      'GET',
      'exceção',
      `(id=${mid})`,
      why,
    );
    return remote;
  }
}

/**
 * Pré-baixa em ondas de 3 músicas (playlist ambiente), sem bloquear playback.
 */
export function prefetchPlaylistTracks(playlist: Playlist, excludeMusicaId: number): void {
  const comUrl = playlist.musicas.filter(
    (m) => m.url_musica && Number(m.musica.id) !== excludeMusicaId,
  );
  const slice = comUrl.slice(0, 15);

  void (async () => {
    for (let i = 0; i < slice.length; i += 3) {
      const chunk = slice.slice(i, i + 3);
      await Promise.all(
        chunk.map((mc) => ensurePlaybackUrl(mc, playlist.id).catch(() => undefined)),
      );
    }
  })();
}
