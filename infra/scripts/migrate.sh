#!/usr/bin/env bash
# Aplica api/db/migrations/*.sql no Postgres do compose, em ordem, uma vez cada
# (tabela schema_migrations), cada arquivo numa transação. Roda na instância
# (root), chamado pelo remote-deploy.sh com o container do banco no ar.
# Migration roda ANTES do código novo da API, então tem de ser compatível com o
# código antigo (aditiva).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$ROOT/api/db/migrations"
DB="${RC_DB_CONTAINER:-runcodes-database-1}"

sql() { docker exec -i "$DB" psql -U postgres -d runcodes -v ON_ERROR_STOP=1 -qtA "$@"; }

sql -c "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())"

applied=0
for f in $(ls "$DIR"/*.sql | sort); do
  name="$(basename "$f")"
  if [ -n "$(sql -c "select 1 from schema_migrations where name='$name'")" ]; then
    continue
  fi
  echo "  aplicando $name"
  { echo "BEGIN;"; cat "$f"; echo; echo "INSERT INTO schema_migrations(name) VALUES ('$name');"; echo "COMMIT;"; } | sql >/dev/null
  applied=$((applied + 1))
done
echo "  migrations: $applied aplicada(s), $(sql -c 'select count(*) from schema_migrations') no total"
