# CORS em `get_musica` — activação para primeira carga sem banda MP3 na Netlify

Este documento alinha **infraestrutura (DigitalOcean / Nginx ou Apache)** e **frontend (Netlify build)** para o browser fazer **`fetch` directo** a  
`https://cloud.radioibiza.com.br/services/webservice/get_musica/` a partir da origem  
`https://player4.radioibiza.com.br`, **sem** passar pelo proxy `/ws-get_musica_cloud` na Netlify.

O código suporta **`VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST`** (priorizar **`cloud`** no prefetch)  
e **`VITE_IBIZA_PREFETCH_GET_MUSICA_SKIP_NETLIFY_FALLBACK`** (omitir **`/ws-get_musica_cloud`** no prefetch e no retry **`play()`**). O **`netlify.toml`** do repo usa **`CLOUD_DIRECT_FIRST="1"`** e **`SKIP="1"`** — **só `cloud`** no MP3 (fail‑fast sem rede Netlify); rollback: **`SKIP="0"`**. (**Em `npm run dev`** o SKIP efectivo permanece **`false`**.)

Snippet de referência: **`deploy/cors-snippet.exemplo.txt`** (adaptar origins e paths).

**Útil durante testes:** na primeira carga, com **`?debug_rede=1`** na URL do `player4`, aparece um painel âmbar com flags de prefetch e linhas das tentativas de `fetch` (por defeito **`token` truncado**). Para colar **URL com query completa** entre equipa: **`&debug_prefetch_token=1`** na mesma URL (ou `VITE_IBIZA_DIAG_PREFETCH_TOKEN_COMPLETO=1` na build), sempre com rede debug activo.

---

## 1 — Infra: aplicar só onde precisa

- **Hostname que serve músicas nos browsers**: `cloud.radioibiza.com.br`.
- **Path** (canonical no player após redirects): **`/services/webservice/get_musica`** (normalmente **`/services/webservice/get_musica/`** com query `token`, `id_musica`, `playlist_id`, etc.).
- **Origem autorizada**: **`https://player4.radioibiza.com.br`** (lista fechada; evitar `*` em produção com pedidos não anónimos mais tarde).

**Recomendação**: restringir regras CORS a **`location`** (Nginx) ou `<Directory>/<Location>` (Apache) **só** para esse path ou prefixo **`/services/webservice/get_musica`** — não abrir POST de login só por engano até haver política definida pelos outros endpoints que precisam de CORS.

**Métodos**: pelo menos **`GET`**, **`HEAD`**, **`OPTIONS`**.

**Cabeçalhos úteis em `Access-Control-Allow-Headers`**: `Accept`, `Range` (possível em fluxos grandes), e o que já usarem em testes (`Content-Type`, etc.). Se o servidor PHP enviar cabeçalhos próprios, espelhar o que aparece como **blocked** no DevTools.

**`OPTIONS`**: responder **204** (ou 200 corpo vazio) com os mesmos `Access-Control-Allow-*` — sem corpo obrigatório.

**`always` em Nginx** (`add_header ... always`): importante para erros/status não 2xx continuarem com CORS legível onde aplicável — alinhar com a doc Nginx dos vossos.

---

## 2 — Validar **antes** de mudar env na Netlify

### Com `curl` (troque `TOKEN` / `ID` por valores de teste curtos válidos):

```bash
curl -sI -o /dev/null -w "%{http_code}\n" \
  -H "Origin: https://player4.radioibiza.com.br" \
  "https://cloud.radioibiza.com.br/services/webservice/get_musica/?token=TOKEN&id_musica=ID"

curl -sI \
  -H "Origin: https://player4.radioibiza.com.br" \
  -H "Access-Control-Request-Method: GET" \
  -X OPTIONS \
  "https://cloud.radioibiza.com.br/services/webservice/get_musica/?token=TOKEN&id_musica=ID"
```

No primeiro pedido espera‑se **`Access-Control-Allow-Origin: https://player4.radioibiza.com.br`** (ou igual ao Origin enviado) na resposta.

### No Chrome (prova final)

Com o PWA aberto em `https://player4.radioibiza.com.br`:

1. Liga **opcionalmente** um build temporário já com **`VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST=1`** num ambiente **staging**, **ou**
2. Consola (**só diagnóstico**, sem logar secrets completos):

   ```javascript
   fetch('https://cloud.radioibiza.com.br/services/webservice/get_musica/?token=…', {
     method: 'GET',
     mode: 'cors',
     credentials: 'omit',
   }).then((r) => console.log(r.status, r.headers.get('content-type')))
   ```

Se existir erro de política (“blocked by CORS”), o header em falta vê‑se na linha da consola Network.

---

## 3 — Netlify (site do player)

O **`netlify.toml`** do repositório traz (**produção: só `cloud` no prefetch / retry `play()`**, CORS válido):

- **`VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST="1"`** — **`fetch`** a **`cloud.radioibiza.com.br`/get_musica** (sem segunda URL de candidato **`ws-get`**).
- **`VITE_IBIZA_PREFETCH_GET_MUSICA_SKIP_NETLIFY_FALLBACK="1"`** — **sem** fallback **`/ws-get_musica_cloud`**; regressão CORS/rede fica visível.

Rollback com **`ws-get`**: **`SKIP="0"`** + rebuild; emergência no painel Netlify se a variável Build sobrepuser o ficheiro.

Sobreposição: **Site settings → Environment variables → Build** substitui o ficheiro se existir a mesma chave.

**Trigger deploy** após alterar env (rebuild obrigatório — variáveis Vite entram na compilação).

Com **`DIRECT=1`** e **`SKIP=1`** (actual): prefetch **`get_musica`** só ao **`cloud`**; o **`<audio>`** em produção já usa URL HTTPS directa ao **`cloud`** (`playbackUrlForAudioElement`).

Com **`DIRECT=1`** e **`SKIP=0`**: cloud primeiro + **`ws-get`** se o **`fetch`** falhar.

Com **`DIRECT=0`** e **`SKIP=0`**: prefetch primeiro **`ws-get`** (retrocesso forte).

## 4 — Rollback / alternar comportamento

- **`netlify.toml`** actual (**só **`cloud`**): **`CLOUD_DIRECT_FIRST=1`**, **`SKIP=1`**.

- **Cloud + rede Netlify `ws-get` ao falhar prefetch**: **`SKIP=0`** (mantém **`CLOUD_DIRECT_FIRST=1`**).

- **Prefetch primeiro só `ws-get`**: **`CLOUD_DIRECT_FIRST=0`**, **`SKIP=0`**.

- **Infra**: reverter apenas o bloco CORS que adicionarem se precisarem.

---

## 5 — Notas ao CakePHP legado no repo

Este repositório **não altera PHP**. CORS vai no **reverse proxy ou camada antes de chegar ao PHP**.  
Se em produção aparecer cabeçalho duplicado (`Access-Control-Allow-Origin` duas vezes), o browser também falha — coordenar com quem gere Nginx/apache para ficar um único lugar a emitir ACAO nos pedidos **`get_musica`**.
