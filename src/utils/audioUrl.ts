/**
 * Streams `get_musica` Radio Ibiza (`*.radioibiza.com.br`):
 *
 * - **Produção (padrão):** URL **HTTPS directa** ao host do `url_musica` (ex.: `envyron` / `cloud`)
 *   — o tráfego pesado de MP3 **não** passa pelo Netlify. Requer **CORS** no servidor de música
 *   para `https://player4.radioibiza.com.br` (e `fetch` / `Range` conforme necessário).
 * - **Fallback:** same-origin `/ws-get_musica_cloud?…` (proxy Netlify / Vite) quando o directo
 *   falha (`cacheManager` + `loop` tentam em seguida).
 * - **`npm run dev`:** por defeito usa o proxy (localhost sem CORS ao cloud).
 * - **Rollback build:** `VITE_IBIZA_FORCE_GET_MUSICA_PROXY=1` força sempre proxy (comportamento antigo).
 *
 * Listagens, ping e demais API continuam em `/api/*` (proxy leve no Netlify).
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

function proxyPrefixForRadioIbizaGetMusica(hostname: string): string | null {
  const h = hostname.toLowerCase();
  if (h.includes('radioibiza.com.br')) {
    return '/ws-get_musica_cloud';
  }
  return null;
}

function forceIbizaMusicaViaProxyNaBuild(): boolean {
  try {
    const v = String(import.meta.env?.VITE_IBIZA_FORCE_GET_MUSICA_PROXY ?? '')
      .trim()
      .toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  } catch {
    return false;
  }
}

function devUsaProxyIbizaPorDefeito(): boolean {
  try {
    return !!import.meta.env?.DEV;
  } catch {
    return false;
  }
}

function usarRewriteProxyIbizaMusica(): boolean {
  return forceIbizaMusicaViaProxyNaBuild() || devUsaProxyIbizaPorDefeito();
}

/** URL HTTPS absoluta do `url_musica`, **sem** passar pela Netlify. */
export function playbackUrlDirectHttpsInclusiveRadioIbiza(
  url: string | undefined | null,
): string {
  if (url == null || url === '') return '';
  const trimmed = url.trim();
  if (trimmed === '') return '';
  return upgradeHttpToHttpsWhenPageSecure(trimmed);
}

/** Same-origin `/ws-get_musica_cloud?…` quando aplicável ao legado Radio Ibiza. */
export function playbackUrlViaGetMusicaSameOriginProxy(
  url: string | undefined | null,
): string {
  const upgraded = playbackUrlDirectHttpsInclusiveRadioIbiza(url);
  if (!upgraded) return '';

  try {
    const u = new URL(upgraded);
    if (!isGetMusicaPathname(u.pathname)) return '';
    const prefix = proxyPrefixForRadioIbizaGetMusica(u.hostname);
    if (!prefix) return '';
    return `${prefix}${u.search}`;
  } catch {
    return '';
  }
}

/**
 * Ordem de tentativas `fetch` para MP3: primeiro o que o browser deve usar em produção (directo),
 * depois proxy same-origin se existir e for distinto.
 */
export function playbackUrlsTryOrderForFetchIbiza(url: string | undefined | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = s.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  const direct = playbackUrlDirectHttpsInclusiveRadioIbiza(url);
  const proxied = playbackUrlViaGetMusicaSameOriginProxy(url);

  if (usarRewriteProxyIbizaMusica()) {
    /* Dev / rollback: proxy primeiro (comportamento histórico). */
    if (proxied) push(proxied);
    if (direct) push(direct);
  } else {
    if (direct) push(direct);
    if (proxied) push(proxied);
  }

  return out;
}

/**
 * URL final para `<audio>` e fluxo “preferido” alinhado ao mesmo critério do `fetch`.
 */
export function playbackUrlForAudioElement(url: string | undefined | null): string {
  const direct = playbackUrlDirectHttpsInclusiveRadioIbiza(url);
  if (!direct) return '';

  if (typeof window === 'undefined') return direct;

  try {
    const u = new URL(direct);
    if (!isGetMusicaPathname(u.pathname)) {
      return direct;
    }
    const prefix = proxyPrefixForRadioIbizaGetMusica(u.hostname);
    if (!prefix) return direct;

    if (usarRewriteProxyIbizaMusica()) {
      return `${prefix}${u.search}`;
    }
    return direct;
  } catch {
    return direct;
  }
}
