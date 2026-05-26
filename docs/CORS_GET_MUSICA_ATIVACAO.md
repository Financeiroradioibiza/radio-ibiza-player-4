# CORS em `get_musica` — activação para primeira carga sem banda MP3 na Netlify

Este documento alinha **infraestrutura (DigitalOcean / Nginx ou Apache)** e **frontend (Netlify build)** para o browser fazer **`fetch` directo** a  
`https://cloud.radioibiza.com.br/services/webservice/get_musica/` a partir da origem  
`https://player4.radioibiza.com.br`, **sem** passar pelo proxy `/ws-get_musica_cloud` na Netlify.

O código suporta **`VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST`** (priorizar **`cloud`** no prefetch)  
e **`VITE_IBIZA_PREFETCH_GET_MUSICA_SKIP_NETLIFY_FALLBACK`** (omitir **`/ws-get_musica_cloud`** no prefetch e no retry **`play()`**). O **`netlify.toml`** do repo volta a usar por defeito **`CLOUD_DIRECT_FIRST="0"`** e **`SKIP="0"`** — primeiro **`fetch`** ao proxy mesmo-origin (**`ws-get`**), depois tentativa **`cloud`** se precisarem; **`SKIP`** em modo `1` força apenas URLs absolutos sem **`ws-get`** (**em `npm run dev`** o SKIP efectivo permanece **`false`**).

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

O **`netlify.toml`** do repositório traz (**produção “como até agora” sem CORS no cloud**):

- **`VITE_IBIZA_PREFETCH_GET_MUSICA_CLOUD_DIRECT_FIRST="0"`** — primeiro **`fetch`** ao mesmo domínio: **`/ws-get_musica_cloud`** (Netlify).
- **`VITE_IBIZA_PREFETCH_GET_MUSICA_SKIP_NETLIFY_FALLBACK="0"`** — mantém proxy e retry **`play()`** via **`ws-get`**.

Para **economizar banda Netlify**: com CORS no **`cloud`** testado — **`CLOUD_DIRECT_FIRST="1"`**; opcionalmente **`SKIP="1"`** para **nunca** usar **`ws-get`** no prefetch (fail‑fast se CORS ausente).

Sobreposição: **Site settings → Environment variables → Build** substitui o ficheiro se existir a mesma chave.

**Trigger deploy** após alterar env (rebuild obrigatório — variáveis Vite entram na compilação).

Com **DIRECT=0**, **SKIP=0**: comportamento clássico — **`ws-get`** evita erro de **`fetch`** por CORS; o **`<audio>`** em produção continua a usar URL **HTTPS** directa ao **`cloud`** onde o código já assim o define (`playbackUrlForAudioElement`).

Para **voltar apenas cloud** quando a infra permitir **`fetch`** ao **`cloud`**: **`DIRECT_FIRST=1`**, **`SKIP`** conforme política (`1` só cloud; `0` com fallback **`ws-get`**).

## 4 — Rollback / alternar comportamento

- **Operação até CORS estar pronto** (**default **`netlify.toml`**): **`DIRECT_FIRST=0`**, **`SKIP=0`** — prefetch primeiro pelo **`ws-get`**. Rebuild/redeploy.

- **Só cloud quando CORS estiver válido**: **`DIRECT_FIRST=1`**, **`SKIP=1`** (ou **`SKIP=0`** se quiserem fallback **`ws-get`** ao falhar rede/CORS).

- **Infra**: reverter apenas o bloco CORS que adicionarem se precisarem.

---

## 5 — Notas ao CakePHP legado no repo

Este repositório **não altera PHP**. CORS vai no **reverse proxy ou camada antes de chegar ao PHP**.  
Se em produção aparecer cabeçalho duplicado (`Access-Control-Allow-Origin` duas vezes), o browser também falha — coordenar com quem gere Nginx/apache para ficar um único lugar a emitir ACAO nos pedidos **`get_musica`**.
