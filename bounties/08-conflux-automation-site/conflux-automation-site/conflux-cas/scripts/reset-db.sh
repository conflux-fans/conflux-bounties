#!/usr/bin/env bash
# reset-db.sh — Wipe the CAS SQLite database and optionally recover from on-chain state.
#
# Usage:
#   ./scripts/reset-db.sh                    # wipe only
#   ./scripts/reset-db.sh --recover 0xAddr   # wipe then recover jobs for owner
#
# The backend auto-migrates the schema on next startup.  Start the stack
# before running --recover so the empty schema exists for the INSERT.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
DB="${DATABASE_PATH:-$ROOT/data/cas.db}"

RECOVER=false
OWNER=""

for arg in "$@"; do
  [[ "$arg" == "--recover" ]] && RECOVER=true && continue
  [[ "$arg" =~ ^0x[0-9a-fA-F]{40}$ ]] && OWNER="$arg"
done

echo ""
echo "═══════════════════════════════════════"
echo " CAS database reset"
echo "═══════════════════════════════════════"
echo " DB path : $DB"
echo ""

# ── Stop worker/backend if running ───────────────────────────────────────────
pkill -f "tsx.*index" 2>/dev/null && echo "  Stopped tsx process" || true
pkill -f "next.*dev"  2>/dev/null && echo "  Stopped next dev"    || true
sleep 1

# ── Backup existing DB ────────────────────────────────────────────────────────
if [[ -f "$DB" ]]; then
  BAK="${DB}.bak.$(date +%Y%m%d_%H%M%S)"
  cp "$DB" "$BAK"
  echo "  Backed up existing DB → $BAK"
fi

# ── Delete and recreate ────────────────────────────────────────────────────────
rm -f "$DB"
echo "  Database wiped."

# ── Optionally recover from on-chain ─────────────────────────────────────────
if $RECOVER; then
  if [[ -z "$OWNER" ]]; then
    echo ""
    echo "Error: --recover requires a wallet address."
    echo "Usage: ./scripts/reset-db.sh --recover 0xYourAddress"
    exit 1
  fi

  echo ""
  echo "  Recovery mode: will restore jobs from on-chain for $OWNER"
  echo "  Start the backend first (so the schema is created), then run:"
  echo ""
  echo "    cd $(realpath "$ROOT/../conflux-triage") && node src/recover.mjs $OWNER --write"
  echo ""
  echo "  Or to preview SQL first:"
  echo "    node src/recover.mjs $OWNER"
fi

echo ""
echo "  Next steps:"
echo "  1. cd $ROOT && pnpm dev    (builds schema on first start)"
if $RECOVER; then
  echo "  2. cd $(realpath "$ROOT/../conflux-triage") && node src/recover.mjs $OWNER --write"
fi
echo ""
