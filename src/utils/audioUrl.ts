/**
 * Streams `get_musica` Radio Ibiza (`*.radioibiza.com.br`):
 *
 * - **Produção (padrão):** URL **HTTPS directa** a **`cloud.radioibiza.com.br`** (mesmo path e query
 *   que no `url_musica`). O webservice pode devolver `http://envyron…`; em HTTPS **envyron** pode
 *   dar `ERR_CONNECTION_REFUSED`; o rewrite Netlify (`/ws-get_musica_cloud`) já usa **cloud**.
 * - **`fetch`/cache/offline (pré-cartão):** sem variáveis extras, primeiro **`/ws-get_musica_cloud`** na Netlify — **toda a cópia
 *   para cache conta na edge Netlify.**
 * - **Saídas sem esse custo (escolha da infra — PHP não obrigatório):**
 *   **`VITE_IBIZA_MP3_CORS_BRIDGE_ORIGIN=https://….`** primeiro tenta esse host (**HTTPS**, mesmo path e query que no `cloud`; ex.: Cloudflare Workers)
 *   a repassar com `Access-Control-Allow-Origin` — ver **`docs/MP3_PREFETCH_FORA_NETLIFY.md`**.
 *   **`VITE_IBIZA_PREFETCH_GET_MUSICA_SKIP_NETLIFY_FALLBACK=1`** — modo **hard** (pré-prod): prefetch **apenas**
 *   URLs absolutos **`cloud`/bridge**, **sem** mesmo-origin **`/ws-get_musica_cloud`**; até o `play()` após erro
 *   também **salta** o retry Netlify (ver **`prefetchGetMusicaNetlifyFallbackDesligadoNaBuild`**).
 * - **`npm run dev`:** proxy Vite primeiro. **`<audio>`** produção: streaming **HTTPS directo ao `cloud`**.
 * - **Rollback build:** `VITE_IBIZA_FORCE_GET_MUSICA_PROXY=1` força sempre proxy.
 *
 * Listagens, ping e demais API continuam em `/api/*` (proxy leve no Netlify).
 */

import { IBIZA_SHELL_VERSION } from '../api/config';

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

/**
 * HTTPS origin do «ponte CORS » (Worker, subdomínio Nginx próprio a repassar get_musica ao cloud com ACAO — ver docs).
 */
function mp3CorsBridgeOriginFromEnv(): string | null {
  const v = String(import.meta.env?.VITE_IBIZA_MP3_CORS_BRIDGE_ORIGIN ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (!v) return null;
  try {
    const u = new URL(v.includes('://') ? v : `https://${v}`);
    if (!/^https:$/i.test(u.protocol)) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Só usar se o `cloud` já envia CORS consumível pelo `fetch` ao player (ver cors-snippet). */
function prefetchGetMusicaCloudDirectFirstFromEnv(): boolean {
  const v = String(import.meta.env?.VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Pré-prod/teste CORS: não incluir `/ws-get_musica_cloud` na lista nem no retry `play()` (ver `loop.ts`).
 * Em `npm run dev` fica sempre `false` para não estragar proxy Vite local. */
export function prefetchGetMusicaNetlifyFallbackDesligadoNaBuild(): boolean {
  try {
    if (import.meta.env?.DEV) return false;
  } catch {
    /* SSR / edge */
  }
  const v = String(import.meta.env?.VITE_IBIZA_PREFETCH_GET_MUSICA_SKIP_NETLIFY_FALLBACK ?? '')
    .trim()
    .toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Valores injectados pela build (`import.meta.env`) — painel `?debug_rede=1` na primeira carga. */
export function musicaPrefetchDiagDoBuild(): Readonly<{
  ibizaShellVersion: string;
  viteDevCompilacao: boolean;
  forceIbizaMusicaProxy: boolean;
  cloudDirectFirst: boolean;
  skipNetlifyPrefetchFallbackEfectivo: boolean;
}> {
  return {
    ibizaShellVersion: IBIZA_SHELL_VERSION,
    viteDevCompilacao: !!import.meta.env?.DEV,
    forceIbizaMusicaProxy: forceIbizaMusicaViaProxyNaBuild(),
    cloudDirectFirst: prefetchGetMusicaCloudDirectFirstFromEnv(),
    skipNetlifyPrefetchFallbackEfectivo: prefetchGetMusicaNetlifyFallbackDesligadoNaBuild(),
  };
}

/** Troca apenas origin/port para o mesmo path+query canonical do `direct` (HTTPS). */
function playbackUrlMesmoPathTrocandoOrigin(directUrl: string, newOriginHttps: string): string {
  try {
    const src = new URL(directUrl);
    const o = new URL(newOriginHttps.startsWith('https://') ? newOriginHttps : `https://${newOriginHttps}`);
    if (!/^https:$/i.test(o.protocol)) return '';
    src.protocol = o.protocol;
    src.hostname = o.hostname;
    src.port = o.port;
    return src.toString();
  } catch {
    return '';
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
 * Ordem de tentativas `fetch` para MP3 cache/local.
 * Ver bloco de comentário no topo deste ficheiro (bridge CORS, direct-first, Netlify fallback).
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
  const bridgeOrigin = mp3CorsBridgeOriginFromEnv();
  const bridgeUrl =
    direct && bridgeOrigin ? playbackUrlMesmoPathTrocandoOrigin(direct, bridgeOrigin) : '';

  const semFb = prefetchGetMusicaNetlifyFallbackDesligadoNaBuild();
  const pushProxied = () => {
    if (!semFb && proxied) push(proxied);
  };

  /** Dev ou build com FORCE_PROXY — mantém comportamento histórico (primeiro mesmo host que o servidor Vite/player). */
  if (usarRewriteProxyIbizaMusica()) {
    pushProxied();
    if (bridgeUrl) push(bridgeUrl);
    if (direct) push(direct);
    return out;
  }

  /** `file://`: URL relativo ao `/ws-*` não serve; primeiro absoluto ao `cloud`/bridge se existirem. */
  if (!prefetchFetchIbizaPreferirProxySameOriginPrimeiro()) {
    if (direct) push(direct);
    if (bridgeUrl) push(bridgeUrl);
    pushProxied();
    return out;
  }

  const directPrimeiroCf = prefetchGetMusicaCloudDirectFirstFromEnv();
  /** Produção browser (`https`): operação deve evitar pré-download via Netlify quando possível. */
  if (directPrimeiroCf) {
    if (direct) push(direct);
    if (bridgeUrl) push(bridgeUrl);
    pushProxied();
    return out;
  }
  if (bridgeUrl) {
    push(bridgeUrl);
    pushProxied();
    /* Evita primeiro `direct` repetido só para falhar CORS em série (ruído + latência); Netlify garante resultado. */
    return out;
  }

  /* Sem bridge nem cloud CORS: só Netlify permite `fetch` legível até haver infra acima. */
  pushProxied();
  if (direct) push(direct);
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
