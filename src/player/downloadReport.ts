/**
 * Envia `musica.id` (POST `/save_atualizadas/`, campo `musicas[]`) — o painel usa isso para a barra «% baixado».
 */

import * as ws from '../api/webservice';
import { storage } from '../storage';
import { useAppStore } from '../store/app';

const pending = new Set<number>();
let debounceTimer: number | null = null;
const DEBOUNCE_MS = 3500;
const BATCH_SIZE = 100;

/** Evita dois ciclos de flush em paralelo (await do save_atualizadas). */
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
  const state = useAppStore.getState();
  const token = state.token?.token;
  if (!token || pending.size === 0) return;

  if (!navigator.onLine) {
    return;
  }

  const idPrograma = Math.trunc(Number(state.playlistData?.programa?.id ?? 0));

  while (pending.size > 0) {
    const batch = spliceNextBatch();
    if (batch.length === 0) break;

    try {
      await ws.saveAtualizadas({
        token,
        musica_ids: batch,
        ...(idPrograma > 0 ? { id_programa: idPrograma } : {}),
      });
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

/** Áudio gravado em cache → enfileira o `musica.id` para o servidor marcar como baixada. */
export function queueDownloadReportForServer(musica_id: number): void {
  const id = Math.trunc(Number(musica_id));
  if (!Number.isFinite(id) || id <= 0) return;
  pending.add(id);
  queueFlushDebounced();
}

/** Reenvia todas as faixas já indexadas (útil após primeira sync ou upgrade do player). */
export async function queueAllIndexedCachedMusicaIdsForReport(): Promise<void> {
  try {
    const list = await storage.listarMusicasCacheadas();
    for (const m of list) {
      const mid = Math.trunc(Number(m.musica_id));
      if (!Number.isFinite(mid) || mid <= 0) continue;
      queueDownloadReportForServer(mid);
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

/** Reindexa caches locais e envia já (não espera só pelo ping seguinte). */
export async function syncCachedDownloadsReportToServer(): Promise<void> {
  await queueAllIndexedCachedMusicaIdsForReport();
  await flushDownloadReportsNow();
}
