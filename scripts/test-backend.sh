#!/usr/bin/env bash
# E2E con backend: Postgres temporaneo + migrazioni reali + server che imita Supabase + app compilata con VITE_SUPABASE_*.
# Uso: npm run test:backend   (richiede PostgreSQL e Playwright/Chromium)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$PGBIN/initdb" ] || PGBIN="$(dirname "$(command -v initdb)")"
DATA="$(mktemp -d)"; OUT="$(mktemp -d)"
PGPORT=55433; API_PORT=54329; APP_PORT=4176
RUN=()
if [ "$(id -u)" = "0" ]; then chown postgres "$DATA"; RUN=(runuser -u postgres --); fi
PIDS=()
cleanup() {
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null || true; done
  "${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DATA" "$OUT"
}
trap cleanup EXIT
"${RUN[@]}" "$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PGPORT -k /tmp -c listen_addresses=localhost" -w start >/dev/null
PSQL=("$PGBIN/psql" -h /tmp -p "$PGPORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -o /dev/null)
"${PSQL[@]}" -f "$ROOT/tests/db/00_supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
OWNER=aaaaaaaa-0000-4000-8000-000000000001; VIEWER=aaaaaaaa-0000-4000-8000-000000000002
"${PSQL[@]}" -c "insert into public.creator_members (user_id, role, label) values ('$OWNER','owner','test'), ('$VIEWER','viewer','test');"

export DATABASE_URL="postgres://postgres@localhost:$PGPORT/postgres"
export FAKE_SUPABASE_PORT=$API_PORT
export FAKE_CREATORS="{\"owner@example.org\":{\"id\":\"$OWNER\",\"password\":\"owner-pass\"},\"viewer@example.org\":{\"id\":\"$VIEWER\",\"password\":\"viewer-pass\"}}"
node "$ROOT/tests/backend/fake-supabase.mjs" & PIDS+=($!)

cd "$ROOT"
VITE_SUPABASE_URL="http://localhost:$API_PORT" VITE_SUPABASE_ANON_KEY="test-anon" npx vite build --outDir "$OUT" --emptyOutDir >/dev/null
"$ROOT/node_modules/.bin/vite" preview --outDir "$OUT" --port $APP_PORT --strictPort >/dev/null 2>&1 & PIDS+=($!)
for _ in $(seq 1 50); do curl -sf "http://localhost:$APP_PORT" >/dev/null && break; sleep 0.2; done

if [ -n "${KEEP_ALIVE:-}" ]; then echo "app http://localhost:$APP_PORT"; sleep "$KEEP_ALIVE"; exit 0; fi
APP_URL="http://localhost:$APP_PORT" API_URL="http://localhost:$API_PORT" node "$ROOT/tests/backend/run.mjs"
