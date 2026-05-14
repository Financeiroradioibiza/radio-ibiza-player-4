# Catálogo de versões — Radio Ibiza Player 4.x

Histórico de releases por target. Cada linha referencia tag git, data de release,
artefato gerado, e principais mudanças. Use junto com o `git log <tag>` para
detalhe completo.

Convenção (ver DEC-009 em `DECISIONS.md`):

- `WEB` — PWA hospedado em `player4.radioibiza.com.br`
- `W` — Electron Windows (`.exe` NSIS, instalação `perMachine`)
- `M` — Electron Mac (`.dmg`) — futuro
- `A` — Android (PWA-instalado por padrão; APK futuro via Capacitor)
- `I` — iOS (PWA-instalado por padrão; IPA futuro via Capacitor)

A string que vai no webservice antigo no `/ping/` (campo `versao_player`) usa o
formato `<X.Y.Z>_<TARGET>` (ex: `4.0.0_W`). É isso que permite filtrar no painel
admin "quantos PDVs estão em cada build".

---

## 4.0.0 (em desenvolvimento)

| Target | Tag git | Data | Artefato | Notas |
|---|---|---|---|---|
| WEB | `v4.0.0-WEB` | 🚧 ainda não taggeada | Deploy Netlify | Migração `radio-ibiza-player-4.netlify.app` → `player4.radioibiza.com.br` |
| W   | `v4.0.0-W`   | 🚧 ainda não taggeada | `RadioIbizaPlayer-4.0.0-W-Setup.exe` | Primeira release Electron com `electron-builder`; signing via Azure Trusted Signing pendente |
| M   | `v4.0.0-M`   | — | — | Adiado: por enquanto Mac usa PWA-instalado |
| A   | `v4.0.0-A`   | — | — | Adiado: por enquanto Android usa PWA-instalado |
| I   | `v4.0.0-I`   | — | — | Adiado: por enquanto iOS usa PWA-instalado |

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

## Aposentadoria de versões antigas

Quando uma versão deixar de receber suporte, mover a linha pra seção
"Aposentadas" abaixo, anotando `data_eol` (end-of-life) e motivo.

### Aposentadas

Nenhuma ainda. O player AIR antigo (legado, fora deste repositório) será
aposentado conforme migração dos PDVs — ver `docs/MIGRACAO-LEGADO.md`
(criar quando começar).
