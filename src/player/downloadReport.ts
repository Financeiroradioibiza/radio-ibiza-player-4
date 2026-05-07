/**
 * Envia `playlist_musica_id` (relação faixa na playlist) via GET `/save_atualizadas/` —
 * o painel usa isso para a barra «% baixado».
 */

import * as ws from '../api/webservice';
import type { MusicaCompleta, PlaylistResponse } from '../types/webservice';
import { storage } from '../storage';
import { useAppStore } from '../store/app';

const pending = new Set<number>();
let debounceTimer: number | null = null;
const DEBOUNCE_MS = 3500;
const BATCH_SIZE = 100;

/** Evita dois ciclos de flush em paralelo (await do GET /save_atualizadas/). */
let flushBarrier: Promise<void> = Promise.resolve();

/** Id que o servidor espera em save_atualizadas (não usar `musica.id` aqui). */
export function playlistsMusicaIdFromFaixa(mc: MusicaCompleta): number {
  const n = Math.trunc(Number(mc.musica.playlist_musica_id));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function playlistsMusicaIdsParaMusicaSalvaLocal(
  programa: PlaylistResponse | null | undefined,
  musicaId: number,
): number[] {
  const needle = Number(musicaId);
  if (!Number.isFinite(needle)) return [];
  const found = new Set<number>();
  for (const pl of programa?.playlists ?? []) {
    for (const mc of pl.musicas ?? []) {
      if (Number(mc.musica.id) === needle) {
        const pid = playlistsMusicaIdFromFaixa(mc);
        if (pid > 0) found.add(pid);
      }
    }
  }
  return [...found];
}

function spliceNextBatch(): number[] {
  const ids: number[] = [];
  for (const id of pending) {
    if (ids.length >= BATCH_SIZE) break;
    pending.delete(id);
    ids.push(id);
  }
  return ids;
}

async function runFlushCycle(): Promise<void> {
  const token = useAppStore.getState().token?.token;
  if (!token || pending.size === 0) return;

  if (!navigator.onLine) {
    return;
  }

  while (pending.size > 0) {
    const batch = spliceNextBatch();
    if (batch.length === 0) break;

    try {
      await ws.saveAtualizadas({ token, playlists_musica_ids: batch });
    } catch (e) {
      console.error('[save_atualizadas]', e);
      batch.forEach((id) => pending.add(id));
      break;
    }
  }

  if (pending.size > 0 && navigator.onLine) {
    queueFlushDebounced();
  }
}

function queueFlushDebounced(): void {
  if (debounceTimer != null) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    flushBarrier = flushBarrier.then(() => runFlushCycle()).catch(console.error);
  }, DEBOUNCE_MS);
}

/** Faixa gravada em cache → enfileira o `playlist_musica_id` para o servidor. */
export function queueDownloadReportForServer(playlists_musica_id: number): void {
  const id = Math.trunc(Number(playlists_musica_id));
  if (!Number.isFinite(id) || id <= 0) return;
  pending.add(id);
  queueFlushDebounced();
}

/** Reenvia todas as faixas já indexadas (útil após primeira sync ou upgrade do player). */
export async function queueAllIndexedCachedMusicaIdsForReport(): Promise<void> {
  try {
    const list = await storage.listarMusicasCacheadas();
    const programa = useAppStore.getState().playlistData;
    for (const m of list) {
      const fromRow =
        m.playlist_musica_id != null && m.playlist_musica_id > 0
          ? [m.playlist_musica_id]
          : [];
      const fromPrograma = playlistsMusicaIdsParaMusicaSalvaLocal(programa, m.musica_id);
      const merged = [...new Set([...fromRow, ...fromPrograma])].filter((n) => n > 0);
      if (merged.length === 0) {
        console.warn(
          '[save_atualizadas] Sem playlist_musica_id para música em cache; painel pode mostrar 0%. id_musica=',
          m.musica_id,
        );
        continue;
      }
      for (const pid of merged) {
        queueDownloadReportForServer(pid);
      }
    }
  } catch {
    //
  }
}

/** Ping / primeira sync / logout: despacha já o que está na fila (sem esperar só o debounce). */
export async function flushDownloadReportsNow(): Promise<void> {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  flushBarrier = flushBarrier.then(() => runFlushCycle()).catch(console.error);
  await flushBarrier;
}

/** Reindexa caches locais contra a programação em memória e envia já (não espera só pelo ping seguinte). */
export async function syncCachedDownloadsReportToServer(): Promise<void> {
  await queueAllIndexedCachedMusicaIdsForReport();
  await flushDownloadReportsNow();
}
