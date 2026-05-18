# Contexto para IA — Radio Ibiza Player 4.0

> Leia este arquivo se você for uma IA assistente (Cursor, Copilot, ChatGPT, etc.) sendo
> chamada para trabalhar neste projeto. Resume tudo que você precisa saber em ~3 minutos.

---

## TL;DR

Reescrita moderna (PWA + Electron) de um player de música ambiente que existia desde 2015
em Adobe Flash/AIR. O backend (CakePHP antigo) é **intocável**. O cliente novo apenas consome
o webservice existente.

A **fundação** está pronta: estrutura de pastas, tipos TS de todos os JSONs do servidor,
cliente HTTP de todos os endpoints, camada de storage abstrata (PWA/Electron), store Zustand,
roteamento, tela de login funcional. **Falta**: engine do player (áudio + agendas), seleção
de PDV real (depende de dados reais do servidor), empacotamento PWA completo, casca Electron.

**Atualização**: grande parte da engine, PDV, PWA e Netlify já existem no repositório. Para um inventário do que o produto faz *neste momento*, abra `docs/ESTADO-COMPLETO-DO-PLAYER-2026-05-18.md` (ou o snapshot mais recente em `docs/` com prefixo `ESTADO-COMPLETO`). Para **Play Store / mobile**, ver `docs/PLAY-STORE-E-MOBILE.md`.

---

## Contexto de negócio

- **Empresa**: Kindle Comunicação, opera a marca "Radio Ibiza"
- **Produto**: música ambiente para PDVs (lojas, restaurantes, etc.)
- **Como funciona**: cada PDV (ponto de venda) tem um computador rodando o player.
  O player loga com email/senha → escolhe o PDV → recebe um token → baixa playlists
  e arquivos de música → toca conforme programação definida no painel admin.

- **Cliente do projeto**: o desenvolvedor tem acesso ao painel admin e pode criar
  usuários/PDVs fictícios pra testar
- **Não tem**: acesso pra modificar o código PHP do servidor. Pode pedir mudanças
  de configuração de servidor (CORS, etc.) mas não código

## Decisões já tomadas

| Decisão | Por quê |
|---------|---------|
| **Dois targets**: PWA padrão + Electron multiusuário | A maioria dos clientes precisa só do simples. 2 clientes específicos têm múltiplos usuários Windows no mesmo PC e precisam que o token fique amarrado à máquina, não ao perfil |
| **Não mexer no PHP** | Decisão do cliente. PHP fica como está |
| **CORS resolvido fora do PHP** | Configuração no Apache/Nginx, ou Cloudflare Worker, ou Electron (que não tem CORS) |
| **Token do PDV é a unidade de identidade** | Isso veio do legado. Email/senha é só pra obter o token; depois o player só usa o token |
| **`.cmfm` é MP3 puro** | Confirmado pelo cliente — extensão diferente é só ofuscação. `<audio>` HTML5 toca direto |
| **React + Vite + TS + Tailwind + Zustand + Dexie** | Stack mainstream pragmática, baixa curva de aprendizagem, longa expectativa de vida |
| **Português nos textos visíveis e comentários** | Equipe é BR, projeto vai ser mantido por brasileiros |

## Arquitetura em 1 desenho

```
┌───────────────────────────────────────────────────────────────────┐
│                  UI (React + Tailwind)                            │
│        LoginPage → SelecionarPdvPage → PlayerPage                 │
├───────────────────────────────────────────────────────────────────┤
│                  store/app.ts (Zustand)                           │
│            ↑ componentes leem aqui via useAppStore()              │
├──────────────────────────────┬────────────────────────────────────┤
│   api/webservice.ts          │   storage/Storage (interface)      │
│   ↓ fetch()                  │   ↓ implementação injetada no boot │
│   webservice CakePHP         │   ┌─ IndexedDBStorage  (PWA)       │
│   (não modificar!)           │   └─ FileSystemStorage (Electron)  │
└──────────────────────────────┴────────────────────────────────────┘
```

## ⚠️ ALERTAS DE SEGURANÇA — LEIA ANTES DE QUALQUER COISA

1. **NUNCA copie credenciais que aparecerem em arquivos do projeto legado.** Os arquivos
   originais do projeto legado tinham várias credenciais hardcoded. **Nada disso entra
   neste projeto novo.** Se você encontrar credenciais em qualquer lugar, **avise o
   desenvolvedor para removê-las e trocá-las** — não as utilize.

2. **NUNCA logue tokens, senhas ou emails completos em produção.** Em desenvolvimento,
   trunque (ex: `token.slice(0, 8) + '...'`) ou use placeholder.

3. **NUNCA mande dados do usuário para serviços de terceiros** sem autorização explícita
   (analytics, error tracking, etc.). Se for adicionar Sentry ou similar, scrubbing de
   PII é obrigatório.

4. **A senha do login NÃO é persistida.** Só email é guardado para conveniência (opcional).
   Senha some assim que o `cliente_id` é obtido.

5. **O token de PDV é o segredo principal.** Tratá-lo com cuidado:
   - Não aparecer em logs/screenshots/exports de debug
   - Em PWA: fica no IndexedDB (perfil do navegador)
   - Em Electron: fica em `C:\ProgramData\RadioIbizaPlayer\sessao.json` (NÃO criptografado
     no MVP — confirmar com cliente se quer adicionar criptografia depois)

## Como o webservice se comporta (resumo)

Veja `PROTOCOLO_WEBSERVICE.md` para detalhes completos.

- Endpoint base (configurável): `/services/webservice/`
- Autenticação: token na query string `?token=XXX`
- POST usa `application/x-www-form-urlencoded`, não JSON
- Resposta sempre JSON, mas com peculiaridades (ver tipos em `src/types/webservice.ts`)
- Erros geralmente vêm como HTTP 200 com `{ mensagem: "..." }` no body

Endpoints principais:
- `POST /login/` — email + senha → cliente_id
- `GET /getPdvs/?id=cliente_id` — lista PDVs com seus tokens
- `GET /loginByToken/?token=X` — valida token e retorna dados do PDV/cliente
- `GET /playlist/?token=X` — programação completa
- `GET /agendas/?token=X` — quando cada playlist toca
- `GET /get_musica/?token=X&id_musica=N&playlist_id=N` — stream MP3
- `GET /ping/?token=X&...` — heartbeat (a cada 60min)
- `GET /save_executadas/?token=X&...` — analytics (música tocada)

## O que está pronto

- [x] Fundação: package.json, tsconfig, Vite, Tailwind, ESLint
- [x] Tipos TS de todos os JSONs do webservice (`src/types/webservice.ts`)
- [x] Cliente HTTP de todos os endpoints (`src/api/webservice.ts`)
- [x] Camada Storage abstrata (`src/storage/`) com PWA e Electron(stub)
- [x] Store Zustand (`src/store/app.ts`)
- [x] Roteamento (`src/App.tsx`)
- [x] Tela de Login funcional
- [x] Tela de SelecionarPdv (stub com debug visual da resposta crua)
- [x] Tela de Player (stub vazio)
- [x] Proxy CORS em desenvolvimento (Vite)
- [x] Documentação completa do protocolo

## O que falta (em ordem de prioridade)

Veja `ROADMAP.md` para tarefas detalhadas.

1. **Implementar SelecionarPdv real** — depende de ver dados reais do `/getPdvs/`
2. **Engine do player** — áudio, agendas, programação, ping (esta é a parte grande)
3. **Cache offline de músicas** — download em background, gerenciamento de espaço
4. **Loop de ping** — heartbeat de 60min com tolerância a falhas
5. **PWA empacotado** — Service Worker, manifest, ícones, instalável
6. **Casca Electron** — main process, preload IPC, autoinit, bandeja, instalador `.exe`

## Como rodar

```bash
npm install
npm run dev   # http://localhost:5173 (PWA mode)
```

Quando começar a trabalhar no Electron:
```bash
npm run dev:electron   # vai precisar criar este script
```

## Arquivos importantes pra ler antes de começar

1. `README.md` — visão geral do projeto
2. `PROTOCOLO_WEBSERVICE.md` — referência da API legada
3. `.cursorrules` — convenções de código
4. `ROADMAP.md` — próximos passos detalhados
5. `src/types/webservice.ts` — modelos de dados
6. `src/api/webservice.ts` — todos os endpoints implementados
7. `src/storage/Storage.ts` — interface de persistência

## Quando estiver em dúvida

- **Sobre o backend**: consulte `PROTOCOLO_WEBSERVICE.md`. Se ainda estiver em dúvida,
  pergunte ao desenvolvedor — ele pode testar a chamada real e mostrar o JSON
- **Sobre arquitetura**: consulte `.cursorrules`. Se a regra não cobrir, prefira o caminho
  mais simples e isolado
- **Sobre comportamento do player original**: o código AS3 antigo é a referência (player
  Adobe AIR). Funções relevantes: `Player.as`, `Login.as`, `Ping.as`, `WindowPDVs.as`,
  `VerificarProgramacao.as`. Mas o desenvolvedor tem o código fonte — peça pra ele
  conferir se você precisar copiar uma lógica específica
