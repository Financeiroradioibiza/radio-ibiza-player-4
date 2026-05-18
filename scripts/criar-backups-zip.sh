#!/usr/bin/env bash
set -euo pipefail

# Gera dois ZIPs em ./backups/: documentação e cópia integral do projeto (quase tudo).
# Uso: da raiz do repo — npm run backup:zip
#
# Inclui: node_modules, dist, dist-electron, .env* (se existirem), .git
# Exclui só: pasta backups/ (evita ZIP dentro do ZIP) e .DS_Store
#
# Opcional: BACKUP_LEVE=1 → ignora node_modules, dist, dist-electron (ZIP menor, pastas
#   devem ser recriadas com npm install / npm run build na outra máquina).

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d)"
NAME="radio-ibiza-player-4"
OUT_DIR="$ROOT/backups"
mkdir -p "$OUT_DIR"

DOC_ZIP="$OUT_DIR/${NAME}-DOCUMENTACAO-${STAMP}.zip"
PROJ_ZIP="$OUT_DIR/${NAME}-PROJETO-COMPLETO-${STAMP}.zip"

echo "→ Documentação → $DOC_ZIP"
cd "$ROOT"
rm -f "$DOC_ZIP"
zip -rq "$DOC_ZIP" \
  README.md \
  START_HERE.md \
  CONTEXTO_PARA_IA.md \
  DECISIONS.md \
  ROADMAP.md \
  PROTOCOLO_WEBSERVICE.md \
  .cursorrules \
  netlify.toml \
  docs/

RSYNC_EXCLUDES=(
  --exclude=backups
  --exclude=.DS_Store
)

if [[ "${BACKUP_LEVE:-0}" == "1" ]]; then
  RSYNC_EXCLUDES+=(
    --exclude=node_modules
    --exclude=dist
    --exclude=dist-electron
    --exclude=dist-ssr
  )
  echo "→ Projeto (modo leve: sem node_modules/dist) → $PROJ_ZIP"
else
  echo "→ Projeto COMPLETO (node_modules + dist se existirem — pode demorar e ficar grande) → $PROJ_ZIP"
fi

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

rsync -a "${RSYNC_EXCLUDES[@]}" "$ROOT/" "$TMP/$NAME/"

rm -f "$PROJ_ZIP"
( cd "$TMP" && zip -rq "$PROJ_ZIP" "$NAME" )

ls -lh "$DOC_ZIP" "$PROJ_ZIP"
echo "Pronto."
