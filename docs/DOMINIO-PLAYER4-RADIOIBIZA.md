# Migração de domínio — `player4.radioibiza.com.br`

Documenta o procedimento de mover o player do domínio Netlify técnico
(`radio-ibiza-player-4.netlify.app`) para um subdomínio próprio em
`radioibiza.com.br`.

## Resultado esperado

| Antes                                                    | Depois                                      |
| -------------------------------------------------------- | ------------------------------------------- |
| `https://radio-ibiza-player-4.netlify.app/login`         | `https://player4.radioibiza.com.br/login`   |
| `https://radio-ibiza-player-4.netlify.app/player`        | `https://player4.radioibiza.com.br/player`  |
| `https://radio-ibiza-player-4.netlify.app/instalar.html` | `https://player4.radioibiza.com.br/instalar.html` |

Os dois domínios continuam funcionando — o subdomínio Netlify técnico permanece
ativo como fallback (deploy previews e em caso de problema com o DNS próprio).

## Pré-requisitos
- `radioibiza.com.br` já está com nameservers no Cloudflare
  (`sharon.ns.cloudflare.com`, `west.ns.cloudflare.com`). Confirmado via WHOIS.
- A conta Netlify "Radio Ibiza" já é dona do site `radio-ibiza-player-4`.
- As mudanças deste commit (HOSTNAMES_OFICIAIS no `aviso-veiculo-tts.mjs`,
  URLs relativas no `instalar.html`) já estão em produção.

## Passo a passo

### 1) Cloudflare — criar o CNAME (~2 minutos)

1. Login em <https://dash.cloudflare.com>.
2. Selecionar o zone `radioibiza.com.br`.
3. Menu lateral `DNS` → `Records`.
4. `Add record`:
   - **Type**: `CNAME`
   - **Name**: `player4`
   - **Target**: `radio-ibiza-player-4.netlify.app`
   - **Proxy status**: **DNS only** (a nuvem cinza, NÃO laranja).
     A nuvem laranja interceptaria o TLS e quebraria o Let's Encrypt do Netlify;
     mantemos o tráfego direto Netlify ↔ cliente. Cache do Cloudflare não é
     necessário (Netlify CDN já entrega tudo da borda).
   - **TTL**: `Auto`
5. `Save`.

### 2) Netlify — adicionar o custom domain (~5 minutos)

1. Login em <https://app.netlify.com>.
2. Abrir o site `radio-ibiza-player-4`.
3. `Site configuration` → `Domain management` → `Domains` → `Add a domain`.
4. Digitar `player4.radioibiza.com.br`. Clicar `Verify` → `Add domain`.
5. Aguardar Netlify provisionar o certificado TLS Let's Encrypt
   (verificar em `HTTPS` da mesma página; normalmente ~30 segundos a 2 min).
6. **Opcional, recomendado**: clicar nos três pontos ao lado de
   `player4.radioibiza.com.br` → `Set as primary domain`. Isso faz o Netlify
   redirecionar `radio-ibiza-player-4.netlify.app/*` →
   `player4.radioibiza.com.br/*` automaticamente (301), mantendo SEO e evitando
   confusão com clientes existentes que tenham o link antigo salvo.

### 3) Confirmação (~2 minutos)

Abrir no browser e validar:
- <https://player4.radioibiza.com.br/> → redireciona para `/login`.
- <https://player4.radioibiza.com.br/instalar.html> → o instalador detecta
  o SO e mostra o botão correto para baixar o PWA.
- <https://player4.radioibiza.com.br/login> → tela de login normal.
- DevTools (Network) → conferir que `Strict-Transport-Security`,
  `Referrer-Policy: no-referrer`, `Content-Security-Policy-Report-Only`
  estão presentes na resposta.

Validar a Netlify Function de TTS:
```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://player4.radioibiza.com.br/.netlify/functions/aviso-veiculo-tts \
  -H "Origin: https://player4.radioibiza.com.br" \
  -H "Content-Type: application/json" \
  -d '{"marca":"X","modelo":"Y","placa":"AAA1234","cor":"Z"}'
# Esperado: 200 (sucesso) ou 429 (rate limit) — NÃO 403.
```

## Reversão (rollback)

Se algo der errado:
1. No Netlify, remover `player4.radioibiza.com.br` do `Domain management` do
   site. O site continua respondendo em `radio-ibiza-player-4.netlify.app`.
2. No Cloudflare, deletar o registro CNAME `player4`.
3. O código continua funcionando nos dois domínios sem rebuild — a lista
   `HOSTNAMES_OFICIAIS` em `aviso-veiculo-tts.mjs` aceita ambos.

## Manutenção pós-migração

Após o subdomínio estar estável e operando 100% por algumas semanas,
opcionalmente:
- **Atualizar `ALLOWED_ORIGINS` no Netlify** (`Site configuration → Environment
  variables`) para `https://player4.radioibiza.com.br,https://radio-ibiza-player-4.netlify.app`.
  Isso desabilita o fallback baseado em `HOSTNAMES_OFICIAIS` no código e
  centraliza a allowlist no painel, mais fácil de revisar.
- **Atualizar a CSP** em `netlify.toml` (se chegarmos a montar `connect-src`
  para hosts externos no futuro).

## Custo

Zero. CNAME no Cloudflare é grátis; custom domain no Netlify é grátis em
qualquer plano; TLS Let's Encrypt é gratuito e renova sozinho a cada 90 dias.
