import { useEffect, useMemo, useState } from 'react';

import { musicaIdsDoPrograma } from '../player/downloadReport';
import { storage } from '../storage';
import { useAppStore } from '../store/app';

/**
 * Estimativa local do «quão completa» está a biblioteca em cache vs programação atual,
 * análogo ao que o painel mostra com base em `atualizadas` no servidor (após ping/sync).
 */
export function useBibliotecaSaude(): {
  totalFaixas: number;
  faixasEmCache: number | null;
  percentualLocal: number | null;
} {
  const playlistData = useAppStore((s) => s.playlistData);
  const [faixasEmCache, setFaixasEmCache] = useState<number | null>(null);

  const totalFaixas = useMemo(() => {
    if (!playlistData?.playlists?.length) return 0;
    let n = 0;
    for (const pl of playlistData.playlists) {
      n += pl.musicas?.length ?? 0;
    }
    return n;
  }, [playlistData]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const idsPrograma = musicaIdsDoPrograma(playlistData);
        const rows = await storage.listarMusicasCacheadas();
        if (cancelled) return;
        let n = 0;
        for (const r of rows) {
          const id = Math.trunc(Number(r.musica_id));
          if (!Number.isFinite(id) || id <= 0) continue;
          if (idsPrograma && !idsPrograma.has(id)) continue;
          n += 1;
        }
        setFaixasEmCache(n);
      } catch {
        if (!cancelled) setFaixasEmCache(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [playlistData?.programa?.id, totalFaixas]);

  const percentualLocal =
    totalFaixas > 0 && faixasEmCache != null
      ? Math.min(100, Math.round((faixasEmCache / totalFaixas) * 100))
      : null;

  return { totalFaixas, faixasEmCache, percentualLocal };
}
