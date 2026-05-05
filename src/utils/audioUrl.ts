/**
 * - Página HTTPS bloqueia `http://` (mixed content).
 * - O webservice devolve `url_musica` apontando para `.../get_musica/?token=...`
 *   (stream via PHP). Em PWA no Netlify isso passa por path na **mesma origem**
 *   (`/ws-get_musica_*`) com proxy no `netlify.toml` / Vite, como `/api`.
 */

function upgradeHttpToHttpsWhenPageSecure(url: string): string {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return url;
  }
  if (/^http:\/\//i.test(url)) {
    return `https://${url.replace(/^http:\/\//i, '')}`;
  }
  return url;
}

function isGetMusicaPathname(pathname: string): boolean {
  return /get_musica/i.test(pathname);
}

function proxyPrefixForHost(hostname: string): string | null {
  const h = hostname.toLowerCase();
  if (h.includes('cloud.radioibiza')) return '/ws-get_musica_cloud';
  if (h.includes('envyron.radioibiza')) return '/ws-get_musica_envyron';
  return null;
}

/**
 * URL final para `<audio>` e para `fetch` no cache (mesma lógica).
 */
export function playbackUrlForAudioElement(url: string | undefined | null): string {
  if (url == null || url === '') return '';
  const trimmed = url.trim();
  if (trimmed === '') return '';

  const upgraded = upgradeHttpToHttpsWhenPageSecure(trimmed);

  if (typeof window === 'undefined') return upgraded;

  try {
    const u = new URL(upgraded);
    if (!isGetMusicaPathname(u.pathname)) {
      return upgraded;
    }
    const prefix = proxyPrefixForHost(u.hostname);
    if (!prefix) {
      return upgraded;
    }
    return `${prefix}${u.search}`;
  } catch {
    return upgraded;
  }
}
