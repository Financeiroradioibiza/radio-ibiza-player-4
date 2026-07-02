# Instalação modo TI — Windows multiusuário

Um login do player **por máquina**, partilhado entre todos os utilizadores Windows (gerente, caixa, etc.).

## O que NÃO é modo TI

| Errado | Certo |
|--------|--------|
| Site `player4.radioibiza.com.br` no Chrome/Edge | Atalho **Radio Ibiza.exe** |
| PWA «Instalar aplicativo» no browser | Instalador `RadioIbiza-*-W-Setup.exe` |
| «Executar como administrador» no dia a dia | Só na **instalação** (TI) |

## Arquitetura per-machine (resumo)

```
Program Files\Radio Ibiza\     ← binários (.exe) — só leitura, perMachine
C:\ProgramData\RadioIbizaPlayer\
  ├── sessao.json              ← TOKEN / login (partilhado — gravado após 1.º login)
  ├── configs.json
  ├── machine_device_id.txt
  ├── audio\                   ← cache MP3
  └── chromium-profile\        ← perfil Electron (NÃO guarda token; evita %APPDATA%)
```

| O quê | Onde **não** fica |
|-------|-------------------|
| Token/sessão | `%APPDATA%`, Program Files, IndexedDB por utilizador |
| Instalador | `perMachine: true` + `customInstall` cria ProgramData + ACL **Built-in Users (BU)** FullAccess |

Login **uma vez** (utilizador normal) → `sessao.json` com token → **todos** os utilizadores Windows leem o mesmo ficheiro.

## Como funciona (técnico)

1. **Instalador** (`perMachine: true`) → `C:\Program Files\Radio Ibiza\` (uma vez, como admin).
2. **Dados partilhados** → `C:\ProgramData\RadioIbizaPlayer\` (todos os utilizadores).
3. **Perfil Chromium** → `C:\ProgramData\RadioIbizaPlayer\chromium-profile\` via `app.setPath('userData', …)` — **não** `%APPDATA%` por utilizador.
4. **Sessão/login** → `sessao.json` em `C:\ProgramData\RadioIbizaPlayer\` (ficheiro partilhado via IPC).
5. **Instalador** corre `setup-programdata-acl.ps1` (PowerShell) para permissões de escrita.

## Procedimento TI

1. `git pull` + `npm run dist:win` (gerar `.exe` recente).
2. Desinstalar versão antiga no PC cliente (a desinstalação **apaga** `C:\ProgramData\RadioIbizaPlayer\` — login e cache local).
3. Só apagar manualmente se a desinstalação falhou ou ficou pasta órfã:
   ```cmd
   rmdir /s /q "C:\ProgramData\RadioIbizaPlayer"
   ```
4. Instalar `.exe` → **Executar como administrador**.
5. **Não** abrir o player como admin — o instalador já não abre automaticamente no fim.
6. Utilizador **normal** → Menu Iniciar → **Radio Ibiza** → login **uma vez**.
7. Outro utilizador **normal** → **Radio Ibiza** → deve entrar **sem** login.

## Verificar se está certo

### Onde o login fica (importante)

| Situação | Onde está o login |
|----------|-------------------|
| **`.exe` modo TI correcto** | `C:\ProgramData\RadioIbizaPlayer\sessao.json` |
| **`.exe` antigo ou modo PWA dentro do Electron** | IndexedDB em `%APPDATA%\Radio Ibiza\` ou `ProgramData\...\chromium-profile\` |
| **Chrome/Edge com player4** | IndexedDB do browser **por utilizador** — não usa ProgramData |

Se `ProgramData` está **vazio** mas o login «volta», quase sempre o atalho abre o **browser** ou um `.exe` **antigo** — não o `sessao.json`.

Após abrir o `.exe` novo, procure `onde-estao-os-dados.txt` em ProgramData **ou** em `%APPDATA%\Radio Ibiza\`. Na pasta de instalação: `onde-esta-o-login.bat`.

### Atalho
Propriedades → Destino = `...\Radio Ibiza.exe`

### Consola (F12) no player
Deve aparecer:
```
[storage] Modo TI — sessao.json em ProgramData (partilhada entre utilizadores Windows)
```

**Não** deve aparecer:
```
[storage] Modo PWA (IndexedDB + Cache Storage)
```

### Ficheiros
```
C:\ProgramData\RadioIbizaPlayer\sessao.json          ← criado na INSTALAÇÃO e no 1.º arranque do .exe
C:\ProgramData\RadioIbizaPlayer\configs.json
C:\ProgramData\RadioIbizaPlayer\machine_device_id.txt
C:\ProgramData\RadioIbizaPlayer\chromium-profile\
C:\ProgramData\RadioIbizaPlayer\ultimo-arranque.txt
```

O instalador (como admin) e cada arranque do `.exe` garantem que `sessao.json` existe — mesmo antes do login. Após login, o mesmo ficheiro passa a ter o `token`.

Em `ultimo-arranque.txt` (após abrir o .exe uma vez):

- `userData=` → `...\ProgramData\RadioIbizaPlayer\chromium-profile` (não `%APPDATA%`)
- `sessao_json=` → `sim-sem-token` antes do login; `sim-com-token` depois
- `storage_bootstrap=ok` → criação automática dos ficheiros funcionou

## Reparo (raro)

Na pasta de instalação, como **admin**:
`corrigir-permissoes-multiusuario.bat`

## Licenciamento

Login partilhado = **uma sessão por PC**. Qualquer utilizador local da máquina usa o mesmo PDV.

---

## Marco validado — 2026-07-02

Instalador TI **per-machine** testado em PC Windows real: **login uma vez → todos os utilizadores Windows entram sem novo login**. Lease impede duas instâncias a tocar em simultâneo no mesmo PC.

**Baseline de código** (último fix da série de login/storage): commit `46a26a7` em `main` (`npm run dist:win`).

### Teste multiusuário (checklist)

1. **User A** (normal): Menu Iniciar → **Radio Ibiza** → e-mail → escolher PDV → player a tocar.
2. **User B** (normal, outra sessão Windows): abrir **Radio Ibiza** → deve entrar **sem** login (lê `sessao.json`).
3. Se User A ainda tiver o player aberto → User B vê diálogo **«Player já activo neste PC»** (lease em `player-instance-lease.json`).
4. Fechar User A → User B abre de novo → entra e toca.

### Evidência em `storage-audit.log`

Ficheiro: `C:\ProgramData\RadioIbizaPlayer\storage-audit.log`

| Linha (padrão) | Significado |
|----------------|-------------|
| `renderer-bridge api=sim storage=sim ti=sim` | Preload expôs `electronAPI`; storage FS; modo TI activo |
| `renderer-fs-ready` | Renderer ligado ao IPC de ficheiros |
| `patch sessao.json ... token=nao` | Gravação após e-mail (ainda sem token) |
| `patch sessao.json ... token=sim` | Gravação após escolher PDV — **login persistido** |

Comandos rápidos (cmd):

```cmd
findstr /i "token renderer-bridge patch" "%ProgramData%\RadioIbizaPlayer\storage-audit.log"
powershell -NoProfile -Command "try { (Get-Content '%ProgramData%\RadioIbizaPlayer\sessao.json' -Raw | ConvertFrom-Json).token.token.Substring(0,8) + '...' } catch { 'sem token' }"
```

Ou, na pasta de instalação como admin: `diagnostico-multiusuario.bat` (secções 1–7).

### `ultimo-arranque.txt` esperado

- `userData=` → `...\ProgramData\RadioIbizaPlayer\chromium-profile\...` (não `%APPDATA%`)
- `sessao_json=sim-com-token` após login completo
- `storage_bootstrap=ok`

### Problemas já resolvidos nesta linha (referência rápida)

| Sintoma | Causa | Fix no código |
|---------|--------|----------------|
| `token: null` em `sessao.json` | Login ia para IndexedDB; gravação falhava | `requireFileSystemStorage`, patch atómico, migração one-shot IndexedDB→ProgramData |
| «Storage do .exe indisponível» | FS forçado antes do preload | Só FS quando `electronAPI.storage` existe |
| Ecrã preto após «Inicializando» | Path `dist/` errado com unpack | `dist` via `app.getAppPath()`; só `preload.mjs` fora do ASAR |
| Login preso em «Entrando…» | `sendSync` bloqueava renderer | `patchJson`/`logEvent` async (`invoke`) + timeout |
| Janela vertical / faixa preta | Touch PWA forçado no Electron | Janela **372×640**; sem `data-ibiza-pwa-touch-os` no TI |
| Reinstalar «lembra» login antigo | Token no perfil Chromium | Migração + perfil em ProgramData; sessão oficial é `sessao.json` |

**Instalador NSIS / scripts de build**: não alterar salvo regressão comprovada — fluxo actual está estável.

### Teste «limpo» (só diagnóstico — não apaga login partilhado)

Para simular «primeira abertura» **sem** desinstalar (mantém `sessao.json`):

```cmd
rmdir /s /q "%ProgramData%\RadioIbizaPlayer\chromium-profile\<utilizador-windows>"
```

Substituir `<utilizador-windows>` pelo nome da pasta do perfil (ex.: `UserA`, `UserB`). **Não** apagar `sessao.json` se quiser confirmar partilha entre users.

Para reset total (login + cache): desinstalar pelo Painel de Controlo (remove ProgramData) ou `rmdir /s /q "%ProgramData%\RadioIbizaPlayer"` **antes** de reinstalar.
