/**
 * Converte nomes tipo pasta vindos do servidor (MAIÚSCULAS, hífens) em título legível na UI.
 */
export function nomePastaParaTitulo(raw: string): string {
  const t = raw.trim();
  if (!t) return 'Playlist';

  const semEspacosNorm = t.replace(/\s+/g, '');
  const pareceSlugServidor =
    /^[A-ZÁÉÍÓÚÃÕÇ0-9][A-ZÁÉÍÓÚÃÕÇ0-9\-_]*$/u.test(t.replace(/\s/g, '_')) ||
    (/^[A-Z0-9_-]+$/u.test(semEspacosNorm) && t.includes('-'));

  if (pareceSlugServidor || t === t.toUpperCase()) {
    return t
      .replace(/[_-]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((pal) => {
        const p = pal.toLowerCase();
        /* Artigos/preposições curtas em minúscula no meio (heurística leve). */
        if (['da', 'de', 'do', 'das', 'dos', 'e'].includes(p) && pal !== t) return p;
        return p.charAt(0).toUpperCase() + p.slice(1);
      })
      .join(' ');
  }

  return t;
}
