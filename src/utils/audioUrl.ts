/**
 * Streams `get_musica` Radio Ibiza (`*.radioibiza.com.br`):
 *
 * - **Produção (padrão):** URL **HTTPS directa** a **`cloud.radioibiza.com.br`** (mesmo path e query
 *   que no `url_musica`). O webservice pode devolver `http://envyron…`; em HTTPS **envyron** pode
 *   dar `ERR_CONNECTION_REFUSED`; o rewrite Netlify (`/ws-get_musica_cloud`) já usa **cloud**.
 * - **`fetch`/cache/offline downloads:** primeiro **`/ws-get_musica_cloud`** (same-origin no player4): o CakePHP em
 *   `cloud` **não** envia cabeçalhos CORS, por isso um `fetch` cross-origin aos MP3 falha sempre no browser —
 *   o proxy Netlify faz o papel de mesmo origem sem poluir consola no pré‑download.
 * - **`npm run dev`:** por defeito usa o proxy. **`<audio>`** em produção continua com streaming **HTTPS directo ao `cloud`**.
 * - **Rollback build:** `VITE_IBIZA_FORCE_GET_MUSICA_PROXY=1` força sempre proxy.
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

/** Host que de facto serve `get_musica` com os mesmos parâmetros (igual ao redirect em `netlify.toml`). */
const CANONICAL_IBIZA_GET_MUSICA_HOST = 'cloud.radioibiza.com.br';

/**
 * `url_musica` pode vir em `envyron` com HTTP; em HTTPS muitos clients recebem `ERR_CONNECTION_REFUSED`
 * nesse host. O proxy de produção já usa `cloud`; alinhámos o URL directo para evitar um primeiro
 * `fetch` falhado (e barras de erro em massa antes do fallback).
 */
function canonicalDirectUrlRadioIbizaGetMusica(upgradedHttps: string): string {
  try {
    const u = new URL(upgradedHttps);
    if (!isGetMusicaPathname(u.pathname)) return upgradedHttps;
    const h = u.hostname.toLowerCase();
    if (!h.endsWith('radioibiza.com.br')) return upgradedHttps;
    if (h === CANONICAL_IBIZA_GET_MUSICA_HOST) return upgradedHttps;
    u.protocol = 'https:';
    u.hostname = CANONICAL_IBIZA_GET_MUSICA_HOST;
    return u.toString();
  } catch {
    return upgradedHttps;
  }
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

/**
 * `fetch` com `mode: 'cors'` ao `cloud.radioibiza.com.br` desde `https://player4…` falha porque o CakePHP
 * não envia `Access-Control-Allow-Origin`. O proxy same-origin evita erro em série na cache/prefetch.
 * Em `file://` (ex.: Electron com `dist/` local), URL relativo ao proxy quebra — priorizamos o URL absoluto.
 */
function prefetchFetchIbizaPreferirProxySameOriginPrimeiro(): boolean {
  try {
    if (typeof window === 'undefined') return true;
    if (window.location.protocol === 'file:') return false;
    return true;
  } catch {
    return true;
  }
}

/** URL HTTPS absoluta do `url_musica`, **sem** passar pela Netlify (host `get_musica` → `cloud`). */
export function playbackUrlDirectHttpsInclusiveRadioIbiza(
  url: string | undefined | null,
): string {
  if (url == null || url === '') return '';
  const trimmed = url.trim();
  if (trimmed === '') return '';
  const upgraded = upgradeHttpToHttpsWhenPageSecure(trimmed);
  return canonicalDirectUrlRadioIbizaGetMusica(upgraded);
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
 * Ordem de tentativas `fetch` para MP3 cache/local: primeiro same-origin onde o CakePHP não dá resposta consumível por CORS;
 * fallback URL absoluto `https://cloud…/get_musica` (Electron `file://` ou se o proxy falhar).
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

  /* Dev / FORCE_PROXY já preferia proxy primeiro. Produção HTTPS idem (cloud sem CORS). */
  const proxyPrimeiro =
    usarRewriteProxyIbizaMusica() || prefetchFetchIbizaPreferirProxySameOriginPrimeiro();

  if (proxyPrimeiro) {
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
