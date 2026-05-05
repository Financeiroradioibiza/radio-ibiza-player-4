/**
 * Envia IDs de músicas já guardadas localmente ao webservice (/save_atualizadas/)
 * para o painel mostrar progresso de download (mesmo fluxo dos players AIR).
 */

import * as ws from '../api/webservice';
import { storage } from '../storage';
import { useAppStore } from '../store/app';

const pending = new Set<number>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 3500;
const BATCH_SIZE = 100;

/** Evita dois ciclos de flush em paralelo (await do POST). */
let flushBarrier: Promise<void> = Promise.resolve();

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
      await ws.saveAtualizadas({ token, musica_ids: batch });
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

/** Uma música acabou de ser persistida no cache local (nova baixa). */
export function queueDownloadReportForServer(musica_id: number): void {
  const id = Math.trunc(Number(musica_id));
  if (!Number.isFinite(id) || id <= 0) return;
  pending.add(id);
  queueFlushDebounced();
}

/** Reenvia todas as músicas já indexadas no IndexedDB (útil após primeira sync). */
export async function queueAllIndexedCachedMusicaIdsForReport(): Promise<void> {
  try {
    const list = await storage.listarMusicasCacheadas();
    for (const m of list) {
      queueDownloadReportForServer(m.musica_id);
    }
  } catch {
    //
  }
}

/** Ping / saída: tenta mandar já, sem ficar esperando só o debounce. */
export async function flushDownloadReportsNow(): Promise<void> {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  flushBarrier = flushBarrier.then(() => runFlushCycle()).catch(console.error);
  await flushBarrier;
}
