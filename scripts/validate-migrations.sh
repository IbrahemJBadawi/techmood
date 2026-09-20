#!/usr/bin/env bash
# Applies every migration in order to a throwaway PostgreSQL database.
# Usage: scripts/validate-migrations.sh [psql-connection-args...]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="techmood_validate_$$"

PSQL=(psql -v ON_ERROR_STOP=1 -q "$@")

echo "==> creating scratch database $DB"
"${PSQL[@]}" -d postgres -c "create database \"$DB\";"
trap '"${PSQL[@]}" -d postgres -c "drop database if exists \"'"$DB"'\";" >/dev/null 2>&1 || true' EXIT

echo "==> applying shim"
"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/local-shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "==> $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

if [ -f "$ROOT/supabase/seed.sql" ]; then
  echo "==> seed.sql"
  "${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql"
fi

echo "==> all migrations applied cleanly"
