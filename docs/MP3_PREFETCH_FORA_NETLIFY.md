# Pré-download MP3 (`fetch`) sem passar tráfego pesado pela Netlify

No browser, **`fetch`** que grava música em IndexedDB/cache **precisa** de resposta legível
(`mode: 'cors'`).

O mesmo-origin **`/ws-get_musica_cloud`** no Player 4 faz **reverse proxy Netlify (`status = 200`)**:
**os gigabytes da primeira carga costumam contar nos limites/quota Netlify.**

**O streaming pelo `<audio>`** continua, por defeito, **HTTPS directo ao `cloud`** (fora Netlify:
ver `src/utils/audioUrl.ts`).

---

## Opção A — CORS no servidor à frente do PHP (preferível)

Sem alterar CakePHP no repo: enviar **`Access-Control-Allow-Origin`** para GET a
`/services/webservice/get_musica/` a partir da origem do PWA (`https://player4.radioibiza.com.br`).

- **Guia checklist (curl + Netlify)** — **`docs/CORS_GET_MUSICA_ATIVACAO.md`**.
- Modelo de cabeçalhos — **`deploy/cors-snippet.exemplo.txt`**.
- Netlify build env: **`VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST=1`** (`1`, `true` ou `yes`).

Daí o client tenta primeiro **`https://cloud…/get_musica`…** Netlify só se falhar.

---

## Opção B — Subdomínio «ponte CORS» barato (ex.: Cloudflare Workers)

Quando não dá para activar logo CORS à frente do `cloud`.

1. Worker que aceite apenas paths que começam por **`/services/webservice/get_musica`** e faça
   **`fetch`** para **`https://cloud.radioibiza.com.br` + mesmo pathname + search**.
2. Nas respostas válidas para o **browser** (`Origin` autorizado): cabeçalhos CORS.
3. HTTPS, por ex. **`https://mp3-bridge.radioibiza.com.br`**.
4. Netlify build env: **`VITE_IBIZA_MP3_CORS_BRIDGE_ORIGIN=https://mp3-bridge.radioibiza.com.br`**
   (sem barra final; só o origin).

Ordem no client: **`[bridge, Netlify]`** — evita tentar `fetch` directo ao `cloud` sem CORS (ruído).

### Exemplo Worker (copiar com cuidado; endurecer em prod)

```javascript
const UPSTREAM = 'https://cloud.radioibiza.com.br';
const ALLOWED_ORIGINS = new Set(['https://player4.radioibiza.com.br']);
const ALLOWED_PREFIX = '/services/webservice/get_musica';

function allowPath(pathname) {
  const p = pathname.replace(/\/+$/, '');
  const a = ALLOWED_PREFIX.replace(/\/+$/, '');
  return p === a || p.startsWith(`${a}/`);
}

function corsHeaders(request) {
  const o = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.has(o)) return null;
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers':
      request.headers.get('Access-Control-Request-Headers') || 'Range, Accept',
    Vary: 'Origin',
  };
}

function forwardHeaders(incoming) {
  const out = new Headers();
  for (const k of ['range', 'accept', 'accept-language', 'if-none-match', 'if-modified-since']) {
    const v = incoming.headers.get(k);
    if (v) out.set(k, v);
  }
  return out;
}

export default {
  async fetch(request) {
    const u = new URL(request.url);
    if (!allowPath(u.pathname)) return new Response('Forbidden', { status: 403 });

    const c = corsHeaders(request);
    if (!c && request.headers.get('Origin'))
      return new Response('CORS não autorizada', { status: 403 });

    if (request.method === 'OPTIONS' && c) {
      return new Response('', { status: 204, headers: new Headers(c) });
    }
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Método não suportado', { status: 405 });

    const upstreamUrl = `${UPSTREAM}${u.pathname}${u.search}`;
    const up = await fetch(upstreamUrl, {
      method: request.method,
      headers: forwardHeaders(request),
    });
    const h = new Headers(up.headers);
    if (c) for (const [k, v] of Object.entries(c)) h.set(k, v);
    return new Response(up.body, { status: up.status, statusText: up.statusText, headers: h });
  },
};
```

---

## Opção C — Tudo pela Netlify (regressão)

**`VITE_IBIZA_FORCE_GET_MUSICA_PROXY=1`** na build.

---

## Resumo

| Variável | Pré-fetch fora Netlify para os MP3? |
|---------|--------------------------------------|
| (nenhuma) | Em geral **não** — primeiro `/ws-get_musica_cloud` |
| **`VITE_IBIZA_MP3_CORS_BRIDGE_ORIGIN`** | Sim, quando o bridge responder antes do fallback |
| **`VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST=1`** + CORS ao `cloud` | Sim |

Ping e **`/api/*`** continuam volumetricamente insignificantes ao lado dos MP3.
