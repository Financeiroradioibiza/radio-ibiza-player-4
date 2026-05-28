/**
 * Envia `musica.id` (POST `/save_atualizadas/`, campo `musicas[]`) — o painel usa isso para a barra «% baixado».
 */

import * as ws from '../api/webservice';
import { storage } from '../storage';
import { useAppStore } from '../store/app';
import type { PlaylistResponse } from '../types/webservice';

const pending = new Set<number>();
let debounceTimer: number | null = null;
const DEBOUNCE_MS = 3500;
const BATCH_SIZE = 100;

/** Evita dois ciclos de flush em paralelo (await do save_atualizadas). */
let flushBarrier: Promise<void> = Promise.resolve();

/**
 * IDs de `musica.id` presentes no pacote de programação do webservice.
 * Usado para report ao servidor, expurgo de cache e validações.
 */
export function musicaIdsDoPrograma(
  playlist: PlaylistResponse | null | undefined,
): Set<number> | null {
  if (!playlist) return null;
  const out = new Set<number>();
  for (const pl of playlist.playlists ?? []) {
    for (const mc of pl.musicas ?? []) {
      const mid = Math.trunc(Number(mc?.musica?.id));
      if (Number.isFinite(mid) && mid > 0) out.add(mid);
    }
  }
  return out;
}

function idsDoProgramaAtual(playlist: PlaylistResponse | null | undefined): Set<number> | null {
  return musicaIdsDoPrograma(playlist);
}

function spliceNextBatch(idsValidos: Set<number> | null): number[] {
  const ids: number[] = [];
  const descartar: number[] = [];
  for (const id of pending) {
    if (idsValidos && !idsValidos.has(id)) {
      // Sobras do cache (programa antigo) — remove da fila e não envia.
      descartar.push(id);
      continue;
    }
    if (ids.length >= BATCH_SIZE) break;
    ids.push(id);
  }
  for (const id of ids) pending.delete(id);
  for (const id of descartar) pending.delete(id);
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
  const idsValidos = idsDoProgramaAtual(state.playlistData);

  // Sem programa carregado ainda: aguarda próximo ciclo (não enviar com `id_programa=0`
  // quando há sobras de cache antigo, senão reaparecem como % > 100 no painel).
  if (idPrograma <= 0 || !idsValidos || idsValidos.size === 0) return;

  while (pending.size > 0) {
    const batch = spliceNextBatch(idsValidos);
    if (batch.length === 0) break;

    try {
      await ws.saveAtualizadas({
        token,
        musica_ids: batch,
        id_programa: idPrograma,
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
  // Defesa em profundidade: se o store já tem programa atual, descarta antes de mexer
  // na fila qualquer id que não pertence (cache de programa antigo). O `runFlushCycle`
  // refaz esse filtro no envio, mas barrar aqui evita acumular sobra na memória.
  const state = useAppStore.getState();
  const idsValidos = idsDoProgramaAtual(state.playlistData);
  if (idsValidos && idsValidos.size > 0 && !idsValidos.has(id)) return;
  pending.add(id);
  queueFlushDebounced();
}

/** Reenvia todas as faixas já indexadas (útil após primeira sync ou upgrade do player). */
export async function queueAllIndexedCachedMusicaIdsForReport(): Promise<void> {
  try {
    const list = await storage.listarMusicasCacheadas();
    const state = useAppStore.getState();
    const idsValidos = idsDoProgramaAtual(state.playlistData);
    for (const m of list) {
      const mid = Math.trunc(Number(m.musica_id));
      if (!Number.isFinite(mid) || mid <= 0) continue;
      // Pula o que não está na programação atual — evita inflar a barra «% baixado».
      if (idsValidos && idsValidos.size > 0 && !idsValidos.has(mid)) continue;
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
