# Catálogo de versões — Radio Ibiza Player 4.x

Histórico de releases por target. Cada linha referencia tag git, data de release,
artefato gerado, e principais mudanças. Use junto com o `git log <tag>` para
detalhe completo.

Convenção (ver DEC-009 e **DEC-011** em `DECISIONS.md`):

- `WEB` — PWA hospedado em `player4.radioibiza.com.br` (**também** o caminho padrão
  para a maioria dos PDVs **Windows**: Chrome/Edge instalável; ver DEC-011)
- `W` — Electron Windows (`.exe` NSIS, `perMachine`, `ProgramData`) —
  **linha separada** para cliente(s) enterprise; release planejada **`4.0.1-W`**
  (no ping: `4.0.1_W`; comercialmente pode citar “W4.01”)
- `M` — Electron Mac (`.dmg`) — futuro
- `A` — Android (PWA-instalado por padrão; APK futuro via Capacitor)
- `I` — iOS (PWA-instalado por padrão; IPA futuro via Capacitor)

A string que vai no webservice antigo no `/ping/` (campo `versao_player`) usa o
formato `<X.Y.Z>_<TARGET>` (ex: `4.0.0_W`). É isso que permite filtrar no painel
admin "quantos PDVs estão em cada build".

---

## 4.0.0 (foco rollout maioria — em desenvolvimento)

| Target | Tag git | Data | Artefato | Notas |
|---|---|---|---|---|
| WEB | `v4.0.0-WEB` | 🚧 ainda não taggeada | Deploy Netlify | **Windows padrão**: PWA Chrome/Edge; guia `instalar.html` para **Windows 11+** (`ms-settings:appsstartup`); `versao_player` `4.0.0_WEB`; ver DEC-011 |
| M   | `v4.0.0-M`   | — | — | Adiado: Mac usa PWA-instalado |
| A   | `v4.0.0-A`   | — | — | Adiado: Android usa PWA-instalado |
| I   | `v4.0.0-I`   | — | — | Adiado: iOS usa PWA-instalado |

## 4.0.1 (Windows enterprise / multiusuário — **depois** do 4.0.0)

| Target | Tag git | Data | Artefato | Notas |
|---|---|---|---|---|
| W   | `v4.0.1-W`   | 🚧 planejada | `RadioIbiza-…-W-Setup.exe` | Electron + `ProgramData` + NSIS `perMachine`; signing Azure (DEC-010); para **único(s) cliente(s)** GPO/multiusuário |

O código e scripts `build:win` / `electron-builder` no repo servem esta linha **W**;
não são o artefato principal de distribuição para os ~99% dos PDVs (DEC-011).

---

## Procedimento de release (passo a passo)

Quando for fechar uma versão, fazer **na ordem**:

1. **Validar localmente**:
   - `npm run lint` — sem erros.
   - `npx tsc --noEmit` — sem erros.
   - `npm run build` — build de produção limpo.
2. **Atualizar `package.json` version**: `"version": "4.0.0"` (sem o sufixo `-dev`).
3. **Atualizar este arquivo** com a linha do target sendo lançado.
4. **Commit**: `chore: release X.Y.Z-<target>`.
5. **Tag git anotada**:
   ```bash
   git tag -a vX.Y.Z-<TARGET> -m "Radio Ibiza Player X.Y.Z (<TARGET>)"
   git push origin vX.Y.Z-<TARGET>
   ```
6. **Build do artefato**:
   - `WEB`: deploy automático no Netlify a partir do `main`.
   - `W`: `npm run dist:win` (com signing Azure) ou `npm run build:win` (sem).
   - `M`, `A`, `I`: ver guias específicos quando forem ativados.
7. **Arquivar binário** em `dist/releases/vX.Y.Z-<TARGET>/` localmente (não vai pro git).
8. **Subir como GitHub Release** anexado à tag (interface web do GitHub).
9. **Notificar cliente** com link de download e changelog.

---

## Instalação Windows (PWA) — referência de SO

O guia `public/instalar.html` assume **Windows 11 ou posterior** (atalho
`ms-settings:appsstartup`, **Configurações → Aplicativos → Inicialização**). No
Windows 10 os passos costumam ser análogos, com pequenas diferenças nos rótulos da
Microsoft.

---

## Aposentadoria de versões antigas

Quando uma versão deixar de receber suporte, mover a linha pra seção
"Aposentadas" abaixo, anotando `data_eol` (end-of-life) e motivo.

### Aposentadas

Nenhuma ainda. O player AIR antigo (legado, fora deste repositório) será
aposentado conforme migração dos PDVs — ver `docs/MIGRACAO-LEGADO.md`
(criar quando começar).
