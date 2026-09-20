#!/usr/bin/env bash
# Migrates a throwaway database, seeds it, then runs the business rule tests.
# Usage: scripts/test.sh [psql-connection-args...]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="techmood_test_$$"
PSQL=(psql -v ON_ERROR_STOP=1 -q "$@")

"${PSQL[@]}" -d postgres -c "create database \"$DB\";"
trap '"${PSQL[@]}" -d postgres -c "drop database if exists \"'"$DB"'\";" >/dev/null 2>&1 || true' EXIT

"${PSQL[@]}" -d "$DB" -f "$ROOT/scripts/local-shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -d "$DB" -f "$f"
done
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql"

psql -v ON_ERROR_STOP=1 "$@" -d "$DB" -f "$ROOT/scripts/test-rules.sql"
