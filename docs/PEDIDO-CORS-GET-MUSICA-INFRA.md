# Pedido à infra — CORS em `get_musica` (player4)

Guia simples para encaminhar por e-mail ou ticket. Pode copiar e colar o bloco **“Texto para o ticket”** no fim.

---

## Contexto (1 frase)

O **Radio Ibiza Player 4** (`https://player4.radioibiza.com.br`) precisa de fazer **`fetch`** no browser ao MP3 em  
`https://cloud.radioibiza.com.br/services/webservice/get_musica/` — hoje o Chrome **bloqueia** porque **falta CORS** na resposta; o player continua a funcionar via **proxy Netlify**, mas isso **aumenta custo de banda** na Netlify.

---

## O que pedir

1. **Onde:** só no endpoint de música **`/services/webservice/get_musica`** (ou prefixo equivalente que servirem hoje o MP3).  
   Não é necessário abrir CORS em todo o webservice.

2. **Quem pode chamar (origem):** apenas  
   **`https://player4.radioibiza.com.br`**  
   (não há outro player web a considerar.)

3. **Nos pedidos que o browser faz com `Origin: https://player4.radioibiza.com.br`**, a **resposta** tem de incluir pelo menos:

   - **`Access-Control-Allow-Origin: https://player4.radioibiza.com.br`**

4. **`OPTIONS` (preflight):** se o browser enviar `OPTIONS` a esse URL, a resposta deve ser **sucesso** (ex.: **204** ou **200**) **com os mesmos cabeçalhos CORS** adequados (`Allow-Methods`, `Allow-Headers` conforme precisarem — típico incluir **`GET`**, **`HEAD`**, **`OPTIONS`** e headers como **`Accept`**, **`Range`** se forem pedidos).

5. **Cuidados:**
   - **Não duplicar** `Access-Control-Allow-Origin` (várias camadas a somar o mesmo header quebra o browser).
   - O **player antigo em AIR** não depende deste mecanismo de CORS do Chrome; o impacto é **só** para **JavaScript** no **player4**.

---

## Como eles confirmam que está certo

**No terminal (substituir token/id por um teste curto):**

```bash
curl -sI -H 'Origin: https://player4.radioibiza.com.br' \
  'https://cloud.radioibiza.com.br/services/webservice/get_musica/?token=TOKEN&id_musica=ID&playlist_id=PLAYLIST'

curl -sI \
  -H 'Origin: https://player4.radioibiza.com.br' \
  -H 'Access-Control-Request-Method: GET' \
  -X OPTIONS \
  'https://cloud.radioibiza.com.br/services/webservice/get_musica/?token=TOKEN&id_musica=ID&playlist_id=PLAYLIST'
```

Em **ambos** deve aparecer na resposta:

`Access-Control-Allow-Origin: https://player4.radioibiza.com.br`

**No Chrome:** abrir o player4 → DevTools → **Network** → um pedido ao **cloud** `get_musica` → **Response headers** → tem de existir **`access-control-allow-origin`** com o **player4**. A consola **deixa de mostrar** “blocked by CORS” / `ERR_FAILED 200` nesse `fetch`.

---

## Referência técnica no repo

- Checklist maior: **`docs/CORS_GET_MUSICA_ATIVACAO.md`**
- Exemplo de regras (Nginx/Apache — adaptar ao vosso): **`deploy/cors-snippet.exemplo.txt`**

---

## Texto para o ticket (copiar abaixo)

```
Assunto: CORS em get_musica para o Player 4 (player4.radioibiza.com.br)

Precisamos de CORS apenas no endpoint de música no cloud:
https://cloud.radioibiza.com.br/services/webservice/get_musica/

Objetivo: o PWA https://player4.radioibiza.com.br faz fetch ao MP3 nesse URL.
Hoje falta Access-Control-Allow-Origin na resposta — o Chrome bloqueia o fetch (CORS),
embora o servidor devolve 200. Não há outro player web; pode ser origin fixo:
https://player4.radioibiza.com.br

Pedido:
- Incluir Access-Control-Allow-Origin: https://player4.radioibiza.com.br nas respostas
  GET (e HEAD se aplicável) desse path, incluindo respostas de erro se houver.
- Tratar OPTIONS nesse path com 2xx e os cabeçalhos CORS necessários (Allow-Methods,
  Allow-Headers — GET, OPTIONS, Accept, Range se precisarem).
- Evitar cabeçalhos CORS duplicados entre Nginx/PHP/Cloudflare.

Validação sugerida: curl -I com header Origin player4 sobre o URL get_musica (GET e OPTIONS)
e conferir Access-Control-Allow-Origin na resposta.

Detalhes e exemplo de snippet: ver repositório radio-ibiza-player-4 — docs/CORS_GET_MUSICA_ATIVACAO.md
e deploy/cors-snippet.exemplo.txt
```
