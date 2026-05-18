# Estado completo do Radio Ibiza Player 4.0 — snapshot 2026-05-18

Este ficheiro descreve **o que o projeto é e faz hoje**, para arquivo junto com os restantes documentos. Não substitui `PROTOCOLO_WEBSERVICE.md` nem `DECISIONS.md` — complementa-os com uma visão única «do alto».

---

## 1. Propósito e restrição central

- **Objetivo**: substituir o player legado (Adobe AIR + AS3) por uma aplicação moderna que fala com o **mesmo** webservice CakePHP 2.x, **sem alterar o PHP**.
- **Consequência**: token em **query string**, POSTs em `application/x-www-form-urlencoded`, JSON por vezes inconsistente — tudo espelhado em `src/types/webservice.ts` e `src/api/webservice.ts`.

---

## 2. Dois alvos, um código

| Alvo | Descrição | Storage |
|------|-----------|---------|
| **PWA (WEB)** | Caminho padrão (~99% Windows e mobile): site em `player4.radioibiza.com.br`, instalável pelo navegador. | `IndexedDB` + Cache via Dexie (`src/storage/IndexedDBStorage.ts`) |
| **Electron (W/M/…)** | Reservado a cenários multiusuário Windows / `ProgramData` (versão comercial separada, ver `DEC-009` / `DEC-011`). | `FileSystemStorage` + IPC em `electron/` |

A escolha fatídica é feita em `src/storage/index.ts`. O resto da aplicação usa apenas a interface `Storage`.

---

## 3. Stack técnica

- React 18, TypeScript (strict), Vite 5, TailwindCSS, Zustand, Dexie, React Router v6.
- PWA: `vite-plugin-pwa` (Service Worker / Workbox).
- Desktop: Electron + `electron-builder` (NSIS Windows `perMachine` quando aplicável).
- Hospedagem PWA: **Netlify** (`netlify.toml`): build `npm run build`, publish `dist`, proxy `/api/*` → cloud, redirects SPA, headers de segurança.

---

## 4. Fluxo do utilizador (alto nível)

1. **Login** (`LoginPage`): email/senha → webservice devolve token; **senha não é persistida**, só token (e metadados de sessão).
2. **Selecionar PDV** (`SelecionarPdvPage`): lista PDVs; escolha → `loginByToken` → grava sessão e navega ao player.
3. **Primeira carga** (`PrimeiraCargaPage` + componentes): onboarding quando aplicável.
4. **Player** (`PlayerPage` + `src/player/*`): áudio, programação, vinhetas, cache de músicas, painéis (playlists, shopping, feedback, etc.).
5. **Desativar**: após muitos pings falhados (`LIMITES`), política alinhada ao AS3.

---

## 5. Módulos principais do código (`src/`)

| Área | Ficheiros / pasta | Função |
|------|---------------------|--------|
| API HTTP | `api/webservice.ts` | Único sítio de `fetch` ao CakePHP; um método por endpoint. |
| Config | `api/config.ts` | `API_BASE_URL`, limites de ping, `VERSAO_PLAYER` por target, URLs das Netlify Functions (avisos, etc.). |
| Tipos | `types/webservice.ts` | Formas dos JSON reais do servidor. |
| Estado | `store/app.ts` | Sessão, PDV, playlists, agendas, tema UI, avisos operador, etc. |
| Persistência | `storage/*` | Interface + PWA + Electron. |
| Engine | `player/programacao.ts`, `loop.ts`, `audioEngine.ts`, `cacheManager.ts`, `vinhetas.ts`, `pingMarcacao.ts`, `downloadReport.ts`, … | Reprodução, filas, cache, reporte ao servidor. |
| Sync / rede | `hooks/usePingLoop.ts`, `useProgramacaoSync.ts`, `fetchProgramacao.ts` | Ping periódico, dreno de fila offline, atualização de programação. |
| Avisos operador (UI) | `api/playerAvisos.ts`, `components/PainelAvisoIePdv.tsx` | Mensagens vermelhas; fetch protegido no servidor (ver §7). |
| TTS / voz | `api/tts*.ts`, Netlify Functions | Locução / aviso veículo com moderação server-side onde aplicável. |
| Páginas | `pages/*.tsx` | Login, PDV, Player, admin avisos (`AvisosOperadorAdminPage`), sandbox, etc. |
| Electron | `electron/main.mjs`, preloads, handlers | Janela, URL remota padrão, storage em filesystem. |

---

## 6. Netlify Functions (`netlify/functions/`)

| Function | Papel |
|----------|--------|
| `player-avisos` | **POST** JSON com `token`, `cliente_id`, `pdv_id`, `ma`, `versao_player`. Valida sessão com **`/ping/`** no CakePHP; só então devolve mensagens do blob. **GET** sem dados (`mensagens: []`) para evitar enumeração. Rate limit por IP (`_rateLimitIp.mjs`). |
| `player-avisos-admin` | CRUD administrativo de avisos (credenciais por env); rate limit por IP. |
| `aviso-veiculo-tts.mjs` | TTS para placa (com moderação/auxiliares). |
| `_avisosOperadorStore.mjs`, `_locucaoModeracao.mjs`, `_rateLimitIp.mjs` | Auxiliares compartilhados. |

Variável opcional: **`IBIZA_WEBSERVICE_URL`** (base do webservice para a function `player-avisos` validar o ping); ver `.env.example`.

---

## 7. Segurança e compliance (resumo)

- **Pentest 2026-05-13** (`docs/PENTEST-2026-05-13.md`): Referrer-Policy, COOP, CSP report-only, bloqueio de `.map` em produção, cache headers em `/api` e functions, etc.
- **Endurecimento avisos (2026-05-14)**: leitura pública por IDs não expõe mensagens; admin com throttle.
- **Regras da equipa**: `.cursorrules` — nunca logar token completo/senha; credenciais só no webservice; tipos fiéis ao backend.

---

## 8. Variáveis de ambiente relevantes

- **Build Vite**: `VITE_WEBSERVICE_URL`, `VITE_PLAYER_PUBLIC_ORIGIN`, `VITE_PLAYER_AVISOS_*`, `VITE_IBIZA_TARGET`, `VITE_IBIZA_SHELL_VERSION`, etc. — ver `.env.example`.
- **Netlify (site)**: credenciais admin avisos (`IBIZA_AVISOS_*`), opcional `IBIZA_WEBSERVICE_URL`, blobs para persistência de avisos.

---

## 9. Scripts NPM úteis

- `npm run dev` — desenvolvimento.
- `npm run build` — produção (PWA).
- `npm run build:win` / `dist:win` — artefacto Electron Windows (quando necessário).
- `npm run backup:zip` — gera ZIPs de documentação e projeto (ver `docs/BACKUP-E-RESTAURACAO.md`).

---

## 10. Documentos irmãos (leitura recomendada)

| Documento | Conteúdo |
|-----------|-----------|
| `START_HERE.md` | Arranque rápido humano + IA. |
| `CONTEXTO_PARA_IA.md` | Contexto curto para assistentes. |
| `PROTOCOLO_WEBSERVICE.md` | Endpoints e contratos do backend. |
| `DECISIONS.md` | Decisões arquiteturais (DEC-001 … DEC-011). |
| `ROADMAP.md` | Tarefas futuras e histórico de etapas. |
| `docs/VERSOES.md` | Catálogo de versões / targets. |
| `docs/PENTEST-2026-05-13.md` | Auditoria e mitigações. |
| `docs/AZURE-TRUSTED-SIGNING.md` | Assinatura Windows. |
| `docs/DOMINIO-PLAYER4-RADIOIBIZA.md` | Domínio / DNS. |

---

## 11. Nota sobre «congelamento» Electron

O roadmap comercial prioriza **PWA WEB** para a maioria; Electron permanece no repositório para o público **enterprise** (multiusuário), em linha de release própria — ver `DEC-009` e `DEC-011`.

Este snapshot reflete o repositório na data indicada no título; após mudanças grandes, convém duplicar este ficheiro com nova data ou atualizar as secções afetadas.
