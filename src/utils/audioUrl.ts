/**
 * PWA em HTTPS bloqueia áudio `http://` (mixed content). O webservice às vezes
 * devolve `url_musica` em HTTP mesmo com o mesmo host servindo HTTPS.
 */
export function normalizePlaybackUrl(url: string | undefined | null): string {
  if (url == null || url === '') return '';
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return url;
  }
  if (url.startsWith('http://')) {
    return `https://${url.slice('http://'.length)}`;
  }
  return url;
}
