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

### 3A.1 — Ícones do player

**O que fazer**:
- Pegar o ícone do player AS3 antigo (`bin/icons/`) e gerar versões 192x192, 512x512,
  e maskable
- Colocar em `public/`
- Atualizar `vite.config.ts` (já tem placeholders no manifest)

### 3A.2 — Service Worker funcional

**O que fazer**:
- Já temos `vite-plugin-pwa` configurado, mas o cache de músicas é feito manualmente
  pelo `IndexedDBStorage` (Cache Storage API). Confirmar que isso continua funcionando
  com o SW do Workbox ativo
- Adicionar handler para servir assets quando offline

### 3A.3 — Instalável

**O que fazer**:
- Testar instalação como app no Chrome desktop (botão "Instalar" no omnibox)
- Testar em mobile (Android: "Adicionar à tela inicial")
- Verificar que ícones aparecem corretos em todos os contextos

### 3A.4 — Resolver CORS em produção

**Opções**:
- A) Configurar headers CORS no Apache/Nginx do servidor
  (não mexe no PHP, só na config do servidor web)
- B) Subir Cloudflare Worker como proxy reverso (10 linhas)
- C) Servir o PWA do mesmo domínio do webservice

Combinar com o cliente qual caminho.

---

## 🖥️ Etapa 3B — Casca Electron (versão multiusuário) — **CONGELADA**

> **Congelado (decisão de produto):** o player **prioridade é PWA web** — não é preciso gerar `.exe`
> para o uso normal. Electron existia no plano para **poucos PCs Windows multiusuário** (`ProgramData`
> partilhado). **Não retomar** tray, autoinit, instalador nem `electron-builder` até pedido explícito de cliente.
>
> O repo já contém casca mínima + IPC de storage: `electron/main.mjs`, `electron/preload.mjs`,
> `electron/storage-handlers.mjs` (compatível com `FileSystemStorage`).

### 3B.1 — Estrutura básica do Electron [parcial — congelado]

**O que fazer**:
- Adicionar dependências: `electron`, `electron-builder` (ou `@electron-forge/*`)
- Criar pasta `electron/`:
  - `main.ts` — processo principal: cria janela, gerencia lifecycle
  - `preload.ts` — expõe `window.electronAPI` para a UI (interface definida em
    `src/storage/FileSystemStorage.ts`)
  - `storage-handler.ts` — implementação Node.js de leitura/escrita em
    `C:\ProgramData\RadioIbizaPlayer\`
- Adicionar scripts npm: `dev:electron`, `build:electron`

### 3B.2 — IPC pra storage [implementado — congelado]

**O que fazer**:
Implementar todos os métodos de `ElectronAPI.storage` (definidos em
`src/storage/FileSystemStorage.ts`) usando `ipcMain.handle()` no main process e
`ipcRenderer.invoke()` no preload.

Estrutura no disco:
```
C:\ProgramData\RadioIbizaPlayer\
├── sessao.json
├── configs.json
├── pending-executions\
│   ├── 1.json
│   ├── 2.json
│   └── ...
├── musicas-index.json
└── audio\
    ├── 999.mp3
    ├── 1000.mp3
    └── ...
```

Permissões: leitura+escrita pra todos os usuários Windows (instalador deve cuidar disso).

### 3B.3 — Autoinicialização [congelado — não priorizar]

**O que fazer**:
- Adicionar registro no Windows pra autoinit (`app.setLoginItemSettings()`)
- Configurável via configs do player (toggle "Iniciar com o Windows")
- Padrão: ligado

### 3B.4 — Tray (bandeja do sistema) [congelado — não priorizar]

**O que fazer**:
- Ícone na bandeja com menu de contexto: Abrir / Pausar / Sair
- Ao fechar a janela: minimiza pra bandeja (não fecha o app)
- Reabrir clicando no tray icon

### 3B.5 — Instalador [congelado — não priorizar]

**O que fazer**:
- Configurar `electron-builder` pra gerar `.exe` (NSIS) ou `.msi`
- **Não** assinar digitalmente no MVP (a menos que tenha certificado disponível —
  combinar com cliente)
- Instalador deve colocar app em `C:\Program Files\RadioIbizaPlayer\`
- Instalador deve criar `C:\ProgramData\RadioIbizaPlayer\` com permissões corretas
  (leitura+escrita pra todos os usuários)

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
