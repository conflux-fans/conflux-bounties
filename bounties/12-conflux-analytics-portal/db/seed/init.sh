#!/usr/bin/env bash
set -euo pipefail

/**
 * init.sh — Run migrations then seed the database.
 * Called by the docker-compose `init` service on first start.
 */

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Running migrations..."
for f in "$DB_DIR"/migrations/*.sql; do
  echo "  Applying $(basename "$f")..."
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -f "$f"
done

echo "==> Applying seed data..."
if [ -f "$DB_DIR/seed/seed.sql" ]; then
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -f "$DB_DIR/seed/seed.sql"
fi

echo "==> Database initialized."
