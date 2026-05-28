/**
 * Mantém cache de áudio alinhado ao pacote actual do webservice — remove MP3/metadados
 * de faixas que já não pertencem à programação destinada a este PDV.
 */

import { musicaIdsDoPrograma } from '@/player/downloadReport';
import { storage } from '@/storage';
import type { PlaylistResponse } from '@/types/webservice';

/** Remove blobs e linhas IndexedDB de músicas ausentes do pacote `/playlist/` actual. */
export async function expurgarCacheAudioForaPrograma(
  playlist: PlaylistResponse,
): Promise<number> {
  const validos = musicaIdsDoPrograma(playlist);
  if (!validos || validos.size === 0) return 0;

  let removidos = 0;
  try {
    const cached = await storage.listarMusicasCacheadas();
    for (const m of cached) {
      const mid = Math.trunc(Number(m.musica_id));
      if (!Number.isFinite(mid) || mid <= 0) continue;
      if (validos.has(mid)) continue;
      try {
        await storage.removerAudio(mid);
        await storage.removerMusicaCacheada(mid);
        removidos += 1;
      } catch (e) {
        console.error('[programacao-cache] expurgar id=', mid, e);
      }
    }
  } catch (e) {
    console.error('[programacao-cache] listar', e);
  }
  return removidos;
}
