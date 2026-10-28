#!/usr/bin/env bash
# Avvia un Postgres temporaneo, applica le migrazioni Supabase e i test SQL (RLS, RPC, isolamento).
# Richiede i binari di PostgreSQL (initdb, pg_ctl, psql). Uso: npm run test:db
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || PGBIN="$(dirname "$(command -v initdb)")"
DATA="$(mktemp -d)"
PORT="${PGPORT_TEST:-55432}"
RUN=()
if [ "$(id -u)" = "0" ]; then chown postgres "$DATA"; RUN=(runuser -u postgres --); fi
cleanup() { "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT
"${RUN[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=''" -w start >/dev/null
PSQL=("$PGBIN/psql" -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/tests/db/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migrazione $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -f "$f"
done
for f in "$ROOT"/tests/db/[1-9]*.sql; do
  echo "→ test $(basename "$f")"
  "${PSQL[@]}" -o /dev/null -f "$f"
done
echo "✓ Test database superati"
