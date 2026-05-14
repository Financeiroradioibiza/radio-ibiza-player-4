# Roadmap — Radio Ibiza Player 4.0

Lista ordenada das próximas tarefas. Tarefas pequenas, autocontidas e com critérios
de "pronto" claros. Risque conforme for completando.

---

## 🎯 Etapa 2B — Engine do player

A parte mais "viva" do projeto. Só comece quando a Etapa 1 (selecionar PDV) estiver
realmente funcionando com dados reais do servidor.

### 2B.1 — Implementar `SelecionarPdvPage` real

**Onde**: `src/pages/SelecionarPdvPage.tsx`
**Depende de**: cliente fictício criado no painel + chamada real ao `/getPdvs/` retornando JSON

**O que fazer**:
1. Criar usuário e PDV(s) fictícios no painel admin
2. Logar pelo player com essa conta
3. Olhar a `<pre>` de debug que mostra a resposta crua do `/getPdvs/`
4. Ajustar/criar tipo TS em `src/types/webservice.ts` (ex: `PdvListItem`)
5. Substituir o debug por uma lista renderizada de PDVs (cards com nome + cidade + status)
6. Ao clicar num PDV: extrair o `token`, chamar `/loginByToken/`, popular o store via
   `salvarSessao()`, navegar para `/player`

**Pronto quando**: usuário consegue logar, escolher um PDV, e a página `/player` recebe
o token + dados do PDV em memória + persistidos no IndexedDB.

---

### 2B.2 — Estrutura da engine de player

**Onde**: criar `src/player/`

**Arquivos a criar**:
- `src/player/programacao.ts` — porta a lógica do `VerificarProgramacao.as`. Recebe
  `playlistData` + `agendas` + data/hora atual e retorna QUAL playlist tocar agora
- `src/player/audioEngine.ts` — wrapper em torno do elemento `<audio>` HTML5. Expõe
  `play(url)`, `pause()`, `setVolume()`, callback `onEnded`, controle de fade-in/out
- `src/player/cacheManager.ts` — orquestra download de músicas. Recebe lista de músicas
  da playlist atual, baixa as faltantes (3 em paralelo), reporta progresso, marca
  `salvarMusicaCacheada()` no storage
- `src/player/loop.ts` — orquestra tudo. Hook React `usePlayer()` que retorna estado +
  controles. Internamente: pega playlist atual → sorteia música → toca → na ponta chama
  saveExecutada → escolhe próxima → repete

**Pronto quando**: `PlayerPage` mostra a música tocando, e ela toca em loop trocando
de música conforme a playlist real do servidor.

---

### 2B.3 — Vinhetas programadas e agendadas

**Depende de**: 2B.2 funcionando

**O que fazer**:
- Tipo `VP` (vinheta programada): a cada N minutos (campo `tocar_cada` da agenda),
  interrompe a música ambiente, toca a vinheta inteira, retoma a ambiente
- Tipo `VA` (vinheta agendada): em data/hora específica (`data_agendada` + `hora_inicio`),
  toca uma vez. Marcar como tocada para não repetir

**Onde**: lógica fica em `src/player/programacao.ts` (decide quando tocar)
e `src/player/loop.ts` (executa a interrupção)

---

### 2B.4 — Loop de ping

**Onde**: `src/hooks/usePingLoop.ts`

**O que fazer**:
- Hook que dispara `ws.ping(...)` a cada `LIMITES.TIME_TO_PING_MIN` minutos
- Usar `setInterval` + cleanup no unmount
- Em sucesso: `resetarPings()` + `atualizarPdv(resp.pdv)` + se `pdv.atualizacao_pendente === 'S'`
  re-baixar a `/playlist/`
- Em falha (rede ou `mensagem === 'token_invalido'`): `incrementarPingFalho()`. Se
  `pingTimes > LIMIT_TIMES_PING_OFF`, mudar status para `desativado` e parar o áudio
- Drenar fila de execuções pendentes (chamar `/save_executadas/` para cada uma e remover
  da fila em sucesso)

**Pronto quando**: deixar o player rodando 1 hora, ver no painel admin que o ping foi
recebido, ver no console que a fila de execuções esvaziou.

---

### 2B.5 — Permissões dinâmicas vindas do PDV

**Depende de**: 2B.2 e 2B.4

**O que fazer**:
Os campos `pdv.ctrl_player`, `pdv.ctrl_playlists`, `pdv.ctrl_placa_carro` controlam
o que o operador pode fazer. Reagir a eles na UI:
- `ctrl_player === 'N'`: esconder/desabilitar botões play/pause/next/prev
- `ctrl_playlists === 'N'`: esconder janela de troca manual de playlist
- `ctrl_placa_carro === 'N'`: esconder funcionalidade de "Veículos" (se decidirmos
  implementar — pode ser feature de v4.1)

---

## 📦 Etapa 3A — PWA empacotado

### 3A.1 — Ícones do player [feito]

**Estado**: `public/icon.svg` é a fonte; `npm run generate-icons` gera `icon-192.png`,
`icon-512.png` e `icon-512-maskable.png` (zona segura para `purpose: maskable`).
Manifest em `vite.config.ts` referencia os três.

### 3A.2 — Service Worker funcional [revisão contínua]

**Estado**: `vite-plugin-pwa` + Workbox pré-cacheia shell (`*.js`, `*.css`, `html`, `svg`, `png`).
Áudio em cache separado via app (`IndexedDB` / Cache Storage no PWA). Testar offline após deploy.

### 3A.3 — Instalável

**O que fazer**:
- Testar instalação como app no Chrome desktop (botão "Instalar" no omnibox)
- Testar em mobile (Android: "Adicionar à tela inicial")
- Verificar que ícones aparecem corretos em todos os contextos

**Windows 11 ou posterior (~99% dos PDVs com PC recente, ver DEC-011):** caminho
principal = **PWA no Chrome ou Edge** (mesma tag `WEB` / `versao_player`
`4.0.0_WEB`). Textos de instalação em `instalar.html` assumem **Windows 11+** (atalho
`ms-settings:appsstartup` para a lista **Inicialização**). Windows 10 costuma ser
compatível com caminhos semelhantes. Instalador `.exe` Electron (Etapa 3B) só para
linha **4.0.1-W** depois. **Combinado com o cliente:** app na **inicialização** e
**encerra ao desligar ou reiniciar** (app de utilizador, não serviço em segundo plano).

### 3A.4 — Resolver CORS em produção [Netlify: feito com proxy `netlify.toml`]

**Opções** para outros hosts:
- A) Configurar headers CORS no Apache/Nginx do servidor
  (não mexe no PHP, só na config do servidor web)
- B) Subir Cloudflare Worker como proxy reverso (10 linhas)
- C) Servir o PWA do mesmo domínio do webservice

Combinar com o cliente qual caminho **se** não usar Netlify com `netlify.toml` deste repo.

---

## 🖥️ Etapa 3B — Build Electron Windows (`4.0.1-W`, ex. “W4.01”) — **PARA CLIENTE(S) ESPECÍFICO(S)**

> **Prioridade de rollout (2026-05-15, ver DEC-011)**: a **maioria** dos PDVs Windows
> usa o **mesmo caminho que `WEB`** (Chrome/Edge + PWA / `instalar.html`) — **sem**
> `.exe` Electron como entrega padrão. Esta etapa 3B fica para **depois** do release
> **4.0.0**, numa linha **4.0.1-W** (`versao_player` → `4.0.1_W`) para o(s) cliente(s)
> com GPO/multiusuário/`ProgramData`.
>
> **Decisão técnica (DEC-009)**: build único Electron Windows, `perMachine`,
> dados em `C:\ProgramData\`. Code signing via Azure Trusted Signing — DEC-010.
>
> O repo já contém casca mínima + IPC de storage: `electron/main.mjs`, `electron/preload.mjs`,
> `electron/storage-handlers.mjs` (compatível com `FileSystemStorage`).

### 3B.1 — Casca Electron + IPC storage [feito]

Estado: `electron/main.mjs`, `electron/preload.mjs` e `electron/storage-handlers.mjs`
implementam `FileSystemStorage` via IPC. Estrutura no disco:

```
C:\ProgramData\RadioIbizaPlayer\
├── sessao.json
├── configs.json
├── pending-executions\
├── musicas-index.json
└── audio\
```

### 3B.2 — Empacotamento (`electron-builder` + NSIS) [ativo]

**O que fazer**:
- Adicionar `electron-builder` em devDependencies.
- Configurar `build` no `package.json` com `nsis.oneClick = false`,
  `nsis.perMachine = true`, `nsis.allowToChangeInstallationDirectory = true`.
- Apontar o app empacotado para `https://player4.radioibiza.com.br` em
  produção (via `ELECTRON_START_URL` ou hardcoded no `main.mjs` com fallback).
- Ícones em `build/icon.ico` (256×256, gerado do `public/icon.svg`).
- Scripts npm: `build:win` (sem signing), `dist:win` (com Azure Trusted Signing).

### 3B.3 — Code signing via Azure Trusted Signing [ativo — externa]

Procedimento documentado em `docs/AZURE-TRUSTED-SIGNING.md`:
- Criar conta Microsoft dedicada `tech@radioibiza.com.br`.
- Criar Azure Subscription + Trusted Signing Account.
- Validação de identidade da empresa (2-5 dias úteis).
- Plugar credencial no `electron-builder` via env var no script `dist:win`.

### 3B.4 — Autoinicialização [backlog]

**O que fazer**:
- `app.setLoginItemSettings()` toggle "Iniciar com o Windows" (padrão: ligado).

### 3B.5 — Tray (bandeja do sistema) [backlog]

**O que fazer**:
- Ícone na bandeja com menu Abrir / Pausar / Sair.
- Fechar janela minimiza pra tray (não fecha o app).

---

## 🍎 Etapa 3C — Mac (`4.0.0-M`) — **AGUARDANDO DEMANDA**

> **Decisão (2026-05-14, ver DEC-009)**: por enquanto Mac usa **PWA-instalado**
> via Safari/Chrome ("Adicionar à Tela de Início"). Custo zero, atualização
> automática via deploy Netlify. Empacotamento `.dmg` (Etapa 3C.x) só quando
> aparecer demanda real de cliente Mac que rejeite PWA.

---

## 📱 Etapa 3D — Mobile (`4.0.0-A` / `4.0.0-I`) — **AGUARDANDO DEMANDA**

> **Decisão (2026-05-14, ver DEC-009)**: Android e iOS começam como
> **PWA-instalado** ("Adicionar à Tela Inicial"). Capacitor + lojas (Google
> US$ 25 + Apple US$ 99/ano) só quando houver demanda real de cliente.

---

## 📑 Etapa 4 — Catalogação de versões

Manter `docs/VERSOES.md` atualizado a cada release. Tag git por target:
- `vX.Y.Z-WEB` — PWA Netlify (**inclui** maioria Windows via Chrome/Edge — DEC-011)
- `vX.Y.Z-W` — Electron Windows (ex.: **`v4.0.1-W`** — enterprise / multiusuário)
- `vX.Y.Z-M` — Electron Mac (futuro)
- `vX.Y.Z-A` — Android (futuro)
- `vX.Y.Z-I` — iOS (futuro)

Arquivar binário em `dist/releases/<tag>/` localmente (Git ignora) e fazer upload
ao GitHub Release de cada tag.

---

## 🗄️ Etapa 5 — Aposentadoria de versões legadas (AIR/mobile antigos)

Procedimento documentado em `docs/MIGRACAO-LEGADO.md` (criar quando começarmos).
Resumo: migrar PDV por PDV → confirmar via ping `versao_player` → anunciar EOL
quando ≥90% migrados.

---

## 🧹 Backlog (sem prioridade definida)

- [ ] Toggle escuro/claro (atualmente só escuro)
- [ ] Suporte a múltiplos idiomas (i18n)
- [ ] Exibir capa do álbum/foto do artista quando disponível
- [ ] Equalizador
- [ ] Janela de "estatísticas" (quantas músicas tocaram hoje, etc.)
- [ ] Modo manual: operador escolhe a playlist na hora (respeitando `ctrl_playlists`)
- [ ] Janela de "Veículos" / "Placa de carro" (porta do AS3 — entender com cliente o uso)
- [ ] Updater automático no Electron (`electron-updater`)
- [ ] Telemetria opcional de uso (com consentimento explícito)
- [ ] Migrar token pra header `Authorization: Bearer ...` (requer mudança no servidor — fora do escopo MVP)
- [ ] Resolver os erros conhecidos do servidor antigo: SQL injections, salt fraco, etc.
  (fora do escopo do player, mas relevante pro cliente saber)

---

## 🐛 Bugs conhecidos / coisas a investigar

- [ ] Confirmar que o ping real funciona com `versao_player='4.0.0_WEB'` (o painel
  admin pode filtrar por versão e o nosso valor é novo)
- [ ] Confirmar que `ma=<UUID>` em vez de MAC real não quebra nenhuma lógica do servidor
- [ ] Verificar se o servidor força HTTPS ou aceita HTTP (PWA exige HTTPS pra Service
  Worker — pode ser bloqueador)
