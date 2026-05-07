#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# x402 Preflight Check
# Run before mainnet deployment to verify configuration.
#   Usage:  npm run preflight
#           NETWORK=mainnet npm run preflight
# ─────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
WARN=0
FAIL=0

pass()  { PASS=$((PASS + 1)); printf "${GREEN}  [PASS]${NC} %s\n" "$1"; }
warn()  { WARN=$((WARN + 1)); printf "${YELLOW}  [WARN]${NC} %s\n" "$1"; }
fail()  { FAIL=$((FAIL + 1)); printf "${RED}  [FAIL]${NC} %s\n" "$1"; }

# Load .env if present
if [ -f .env ]; then
  set -a; source .env; set +a
fi

NETWORK="${NETWORK:-testnet}"
echo ""
echo "=========================================="
echo "  x402 Preflight Check — ${NETWORK}"
echo "=========================================="
echo ""

# ─── 1. Required environment variables ───
echo "--- Environment Variables ---"

check_env() {
  local var_name="$1"
  local required="${2:-true}"
  local val="${!var_name:-}"
  if [ -n "$val" ]; then
    # Mask secrets (show first 6 + last 4 chars)
    if [[ "$var_name" == *KEY* || "$var_name" == *SECRET* ]]; then
      local masked="${val:0:6}...${val: -4}"
      pass "$var_name = $masked"
    else
      pass "$var_name = $val"
    fi
  elif [ "$required" = "true" ]; then
    fail "$var_name is not set"
  else
    warn "$var_name is not set (optional)"
  fi
}

check_env "NETWORK"
check_env "SERVICE_WALLET_KEY"
check_env "SERVICE_WALLET_ADDRESS"
check_env "X402_CONTRACT_ADDRESS"
check_env "DATABASE_URL" "false"
check_env "REDIS_URL" "false"
check_env "ADMIN_API_KEY" "false"

if [ "$NETWORK" = "mainnet" ]; then
  echo ""
  echo "--- Mainnet-Specific Checks ---"
  # Warn if using default/empty values
  if [ -z "${ADMIN_API_KEY:-}" ]; then
    fail "ADMIN_API_KEY must be set for mainnet"
  fi
  if [ -z "${DATABASE_URL:-}" ]; then
    warn "DATABASE_URL not set — dev mode uses in-memory store (not suitable for production)"
  fi
fi

# ─── 2. RPC connectivity ───
echo ""
echo "--- RPC Connectivity ---"

if [ "$NETWORK" = "mainnet" ]; then
  RPC_URL="${CONFLUX_RPC_URL:-https://evm.confluxrpc.com}"
  EXPECTED_CHAIN_ID="0x406"  # 1030
else
  RPC_URL="${CONFLUX_RPC_URL:-https://evmtestnet.confluxrpc.com}"
  EXPECTED_CHAIN_ID="0x47"   # 71
fi

CHAIN_ID=$(curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  | grep -o '"result":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")

if [ -z "$CHAIN_ID" ]; then
  fail "Cannot connect to RPC at $RPC_URL"
elif [ "$CHAIN_ID" = "$EXPECTED_CHAIN_ID" ]; then
  pass "RPC responds with correct chain ID ($CHAIN_ID)"
else
  fail "RPC chain ID mismatch: expected $EXPECTED_CHAIN_ID, got $CHAIN_ID"
fi

# ─── 3. Contract deployed ───
echo ""
echo "--- Contract Check ---"

CONTRACT="${X402_CONTRACT_ADDRESS:-}"
if [ -n "$CONTRACT" ] && [ "$CONTRACT" != "0x0000000000000000000000000000000000000000" ]; then
  CODE=$(curl -s -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getCode\",\"params\":[\"$CONTRACT\",\"latest\"],\"id\":1}" \
    | grep -o '"result":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")

  if [ -z "$CODE" ] || [ "$CODE" = "0x" ]; then
    fail "No contract found at $CONTRACT"
  else
    CODE_LEN=${#CODE}
    pass "Contract found at $CONTRACT (${CODE_LEN} bytes)"
  fi
else
  fail "X402_CONTRACT_ADDRESS not set or is zero address"
fi

# ─── 4. Facilitator wallet balance ───
echo ""
echo "--- Facilitator Wallet ---"

WALLET="${SERVICE_WALLET_ADDRESS:-}"
if [ -n "$WALLET" ]; then
  BALANCE_HEX=$(curl -s -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"$WALLET\",\"latest\"],\"id\":1}" \
    | grep -o '"result":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")

  if [ -n "$BALANCE_HEX" ]; then
    # Convert hex to decimal (remove 0x prefix)
    BALANCE_WEI=$(printf "%d" "$BALANCE_HEX" 2>/dev/null || echo "0")
    # Rough conversion: divide by 10^18 (just show order of magnitude)
    if [ "$BALANCE_WEI" -gt 0 ] 2>/dev/null; then
      BALANCE_CFX=$(echo "scale=4; $BALANCE_WEI / 1000000000000000000" | bc 2>/dev/null || echo "~nonzero")
      pass "Facilitator balance: ~${BALANCE_CFX} CFX"
      if [ "$NETWORK" = "mainnet" ]; then
        # Warn if less than 1 CFX
        IS_LOW=$(echo "$BALANCE_CFX < 1" | bc 2>/dev/null || echo "0")
        if [ "$IS_LOW" = "1" ]; then
          warn "Facilitator balance is low (<1 CFX) — settlements may fail"
        fi
      fi
    else
      if [ "$NETWORK" = "mainnet" ]; then
        fail "Facilitator wallet has 0 CFX — cannot pay gas for settlements"
      else
        warn "Facilitator wallet has 0 CFX — use the faucet to get testnet CFX"
      fi
    fi
  else
    warn "Could not query facilitator balance"
  fi
else
  fail "SERVICE_WALLET_ADDRESS not set"
fi

# ─── Summary ───
echo ""
echo "=========================================="
printf "  Results: ${GREEN}%d passed${NC}, ${YELLOW}%d warnings${NC}, ${RED}%d failed${NC}\n" "$PASS" "$WARN" "$FAIL"
echo "=========================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  printf "${RED}Preflight check failed. Fix the issues above before deploying.${NC}\n"
  exit 1
elif [ "$WARN" -gt 0 ]; then
  printf "${YELLOW}Preflight passed with warnings. Review before deploying.${NC}\n"
  exit 0
else
  printf "${GREEN}All preflight checks passed!${NC}\n"
  exit 0
fi
