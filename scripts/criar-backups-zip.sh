#!/usr/bin/env bash
set -euo pipefail

# Gera dois ZIPs em ./backups/: documentação e projeto (sem node_modules/dist).
# Uso: da raiz do repo — npm run backup:zip

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d)"
NAME="radio-ibiza-player-4"
OUT_DIR="$ROOT/backups"
mkdir -p "$OUT_DIR"

DOC_ZIP="$OUT_DIR/${NAME}-DOCUMENTACAO-${STAMP}.zip"
PROJ_ZIP="$OUT_DIR/${NAME}-PROJETO-PARA-CURSOR-${STAMP}.zip"

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

echo "→ Projeto (sem node_modules/dist/env) → $PROJ_ZIP"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

rsync -a \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=dist-electron \
  --exclude=dist-ssr \
  --exclude=backups \
  --exclude=.DS_Store \
  --exclude=.env \
  --exclude=.env.local \
  --exclude=.env.production \
  --exclude=.env.production.local \
  --exclude=.env.development.local \
  "$ROOT/" "$TMP/$NAME/"

rm -f "$PROJ_ZIP"
( cd "$TMP" && zip -rq "$PROJ_ZIP" "$NAME" )

ls -lh "$DOC_ZIP" "$PROJ_ZIP"
echo "Pronto."
