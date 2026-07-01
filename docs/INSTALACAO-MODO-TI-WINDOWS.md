# Instalação modo TI — Windows multiusuário

Um login do player **por máquina**, partilhado entre todos os utilizadores Windows (gerente, caixa, etc.).

## O que NÃO é modo TI

| Errado | Certo |
|--------|--------|
| Site `player4.radioibiza.com.br` no Chrome/Edge | Atalho **Radio Ibiza.exe** |
| PWA «Instalar aplicativo» no browser | Instalador `RadioIbiza-*-W-Setup.exe` |
| «Executar como administrador» no dia a dia | Só na **instalação** (TI) |

## Como funciona (técnico)

1. **Instalador** (`perMachine: true`) → `C:\Program Files\Radio Ibiza\` (uma vez, como admin).
2. **Dados partilhados** → `C:\ProgramData\RadioIbizaPlayer\` (todos os utilizadores).
3. **Perfil Chromium** → `C:\ProgramData\RadioIbizaPlayer\chromium-profile\` via `app.setPath('userData', …)` — **não** `%APPDATA%` por utilizador.
4. **Sessão/login** → IndexedDB nesse perfil partilhado (mesmo código que o PWA, pasta diferente).
5. **Instalador** corre `setup-programdata-acl.ps1` (PowerShell) para permissões de escrita.

## Procedimento TI

1. `git pull` + `npm run dist:win` (gerar `.exe` recente).
2. Desinstalar versão antiga no PC cliente.
3. Apagar dados antigos (recomendado em testes):
   ```cmd
   rmdir /s /q "C:\ProgramData\RadioIbizaPlayer"
   ```
4. Instalar `.exe` → **Executar como administrador**.
5. **Não** abrir o player como admin — o instalador já não abre automaticamente no fim.
6. Utilizador **normal** → Menu Iniciar → **Radio Ibiza** → login **uma vez**.
7. Outro utilizador **normal** → **Radio Ibiza** → deve entrar **sem** login.

## Verificar se está certo

### Atalho
Propriedades → Destino = `...\Radio Ibiza.exe`

### Consola (F12) no player
Deve aparecer:
```
[storage] Modo TI — IndexedDB em ProgramData (sessão partilhada entre utilizadores Windows)
```

**Não** deve aparecer:
```
[storage] Modo PWA (IndexedDB + Cache Storage)
```

### Ficheiros
```
C:\ProgramData\RadioIbizaPlayer\chromium-profile\
C:\ProgramData\RadioIbizaPlayer\ultimo-arranque.txt
```

Em `ultimo-arranque.txt`, `userData=` deve apontar para `...\ProgramData\RadioIbizaPlayer\chromium-profile`, **não** para `C:\Users\...\AppData\Roaming\`.

## Reparo (raro)

Na pasta de instalação, como **admin**:
`corrigir-permissoes-multiusuario.bat`

## Licenciamento

Login partilhado = **uma sessão por PC**. Qualquer utilizador local da máquina usa o mesmo PDV.
