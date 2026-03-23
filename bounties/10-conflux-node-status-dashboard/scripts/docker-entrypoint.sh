#!/bin/sh
set -e

# Auto-seed demo data if the database doesn't exist yet
if [ "${SEED_DEMO_DATA:-true}" = "true" ] && [ ! -f "${DATABASE_PATH:-/app/data/dashboard.db}" ]; then
  echo "[entrypoint] No database found — seeding demo data..."
  node server/dist/seed-demo-data.js
  echo "[entrypoint] Seed complete."
fi

exec "$@"
