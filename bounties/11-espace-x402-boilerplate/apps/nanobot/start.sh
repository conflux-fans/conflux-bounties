#!/usr/bin/env bash
# Launcher for the x402 Payment Concierge (nanobot + MCP bridge)
#
# Loads .env, generates a runtime config with resolved secrets,
# and starts nanobot from the project root so relative paths work.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VENV="$SCRIPT_DIR/.venv"
RUNTIME_CONFIG="$SCRIPT_DIR/.config.runtime.json"

# ── Load .env ──
if [ -f "$PROJECT_ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$PROJECT_ROOT/.env"
  set +a
else
  echo "Error: $PROJECT_ROOT/.env not found. Copy .env.example and fill in your keys." >&2
  exit 1
fi

# ── Validate required vars ──
missing=()
[ -z "${OPENAI_API_KEY:-}" ]        && missing+=("OPENAI_API_KEY")
[ -z "${AGENT_PRIVATE_KEY:-}" ]     && missing+=("AGENT_PRIVATE_KEY")

if [ ${#missing[@]} -gt 0 ]; then
  echo "Error: Missing required environment variables: ${missing[*]}" >&2
  echo "Set them in $PROJECT_ROOT/.env" >&2
  exit 1
fi

# ── Check venv ──
if [ ! -f "$VENV/bin/nanobot" ]; then
  echo "Error: nanobot not installed. Run:" >&2
  echo "  python3 -m venv $VENV && $VENV/bin/pip install git+https://github.com/HKUDS/nanobot.git" >&2
  exit 1
fi

# ── Generate runtime config ──
# The MCP SDK replaces the child process environment with the `env` dict,
# so we must explicitly pass PATH + all vars the MCP server needs.
"$VENV/bin/python3" -c "
import json, os, sys

with open('$SCRIPT_DIR/config.json') as f:
    cfg = json.load(f)

# Inject LLM provider settings (any OpenAI-compatible provider)
cfg['providers']['openai']['apiKey'] = os.environ['OPENAI_API_KEY']
cfg['providers']['openai']['apiBase'] = os.environ.get(
    'OPENAI_API_BASE', 'https://api.openai.com/v1'
)
cfg['agents']['defaults']['model'] = os.environ.get('LLM_MODEL', 'gpt-4o-mini')

# Inject MCP child process env (PATH + agent vars)
cfg['tools']['mcpServers']['x402']['env'] = {
    'PATH': os.environ.get('PATH', '/usr/local/bin:/usr/bin:/bin'),
    'HOME': os.environ.get('HOME', ''),
    'NODE_ENV': 'production',
    'AGENT_PRIVATE_KEY': os.environ['AGENT_PRIVATE_KEY'],
    'API_BASE': os.environ.get('API_BASE', os.environ.get('NEXT_PUBLIC_API_BASE', 'http://localhost:4000')),
    'CONFLUX_RPC_URL': os.environ.get('CONFLUX_RPC_URL', 'https://evmtestnet.confluxrpc.com'),
    'X402_CONTRACT_ADDRESS': os.environ.get('X402_CONTRACT_ADDRESS', ''),
}

with open('$RUNTIME_CONFIG', 'w') as f:
    json.dump(cfg, f, indent=2)
"

trap 'rm -f "$RUNTIME_CONFIG"' EXIT

# ── Start nanobot from project root (so MCP server paths resolve) ──
cd "$PROJECT_ROOT"

echo "Starting x402 Payment Concierge..."
echo "  Agent wallet: use 'check_budget' to see spending limits"
echo "  Type your questions about x402, or ask the bot to call endpoints."
echo ""

exec "$VENV/bin/nanobot" agent \
  --config "$RUNTIME_CONFIG" \
  --workspace "$SCRIPT_DIR/workspace" \
  "$@"
