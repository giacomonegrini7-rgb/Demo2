#!/usr/bin/env bash
# Crea un archivio ZIP del progetto (solo file versionati: niente node_modules, dist o .env).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/travel-recovery-demo-acquirente.zip}"
git -C "$ROOT" archive --format=zip --prefix=travel-recovery-demo-acquirente/ -o "$OUT" HEAD
echo "Creato $OUT"
