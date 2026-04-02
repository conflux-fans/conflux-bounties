# Conflux eSpace x402 Full-Stack Boilerplate

End-to-end reference for **x402 pay-per-request payments** on Conflux eSpace using **ERC-3009 `receiveWithAuthorization`** with USDT0. Three cohesive apps — a Seller API, a Web Frontend, and an AI Agent — demonstrate the full gasless payment lifecycle.

> **Status:** Complete. All acceptance criteria met. Two security audits completed (0 critical/high findings). Built for Conflux Bounty #11.

---

## Table of Contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Reproduce Locally (Step-by-Step)](#reproduce-locally-step-by-step)
- [Alternative: Docker (Production Mode)](#alternative-docker-production-mode)
- [Project Structure](#project-structure)
- [x402 Payment Flow](#x402-payment-flow-erc-3009)
- [Supported Tokens](#supported-tokens)
- [Smart Contracts](#smart-contracts)
- [API Endpoints](#api-endpoints)
- [Web Frontend](#web-frontend)
- [AI Agent](#ai-agent)
- [Environment Variables Reference](#environment-variables-reference)
- [Testing](#testing)
- [Security Audits](#security-audits)
- [Acceptance Criteria](#acceptance-criteria)
- [Troubleshooting](#troubleshooting)
- [Further Reading](#further-reading)

---

## Architecture

```
┌──────────────┐     HTTP 402      ┌──────────────────┐
│  Web Client  │ ◄───────────────► │   Seller API     │
│  (Next.js)   │  x-chain-id hdr  │   (Hono + x402)  │
└──────┬───────┘                   └────────┬─────────┘
       │  EIP-712 sign                      │ settle on-chain
       │  (gasless)                          │ (facilitator pays gas)
       ▼                                    ▼
┌──────────────┐                   ┌──────────────────┐
│   Conflux    │                   │  In-memory store  │
│   eSpace     │                   │  (dev mode) or    │
│  Testnet(71) │                   │  Postgres + Redis │
│ Mainnet(1030)│                   └──────────────────┘
└──────┬───────┘
       │
┌──────┴───────┐
│   AI Agent   │  detects 402 → signs auth → settles → retries
│  (LangChain) │
└──────────────┘
```

See [`docs/architecture.md`](docs/architecture.md) for a detailed Mermaid diagram and component breakdown, and [`docs/sequence.md`](docs/sequence.md) for payment flow sequence diagrams.

---

## Prerequisites

Before you begin, make sure you have the following installed and ready:

| Requirement | Version | How to check | Notes |
|-------------|---------|--------------|-------|
| **Node.js** | 18+ | `node -v` | Required for all components |
| **npm** | 9+ | `npm -v` | Comes with Node.js |
| **Git** | any | `git --version` | To clone the repo |
| **A browser wallet** | — | — | MetaMask, Fluent, or any EVM wallet for the web frontend |
| **Testnet CFX** | — | — | Free from [Conflux eSpace Faucet](https://efaucet.confluxnetwork.org/) — needed to fund the facilitator wallet for gas |
| **Docker** *(optional)* | 20+ | `docker -v` | Only needed for production mode (Postgres/Redis) or monitoring |

**Not required for dev mode:** Postgres, Redis, Docker. The dev mode uses an in-memory store.

---

## Reproduce Locally (Step-by-Step)

Follow these steps in order. The whole process takes ~10 minutes.

### Step 1: Clone and install dependencies

```bash
git clone <repo-url>
cd 11-espace-x402-boilerplate
npm install
```

### Step 2: Create your environment file

```bash
cp .env.example .env
```

### Step 3: Generate wallets

You need **two wallets** — one for the facilitator (seller) and one for the AI agent. Generate them:

```bash
# Generate facilitator wallet
npx tsx -e "import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts'; const k = generatePrivateKey(); console.log('SERVICE_WALLET_KEY=' + k); console.log('SERVICE_WALLET_ADDRESS=' + privateKeyToAccount(k).address)"

# Generate agent wallet (separate from facilitator)
npx tsx -e "import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts'; const k = generatePrivateKey(); console.log('AGENT_PRIVATE_KEY=' + k)"
```

Paste the output values into your `.env` file.

### Step 4: Fund the facilitator wallet with testnet CFX

The facilitator wallet pays gas to settle on-chain payments. Get free testnet CFX:

1. Go to [https://efaucet.confluxnetwork.org/](https://efaucet.confluxnetwork.org/)
2. Paste your `SERVICE_WALLET_ADDRESS`
3. Request testnet CFX (you only need a small amount — ~1 CFX is plenty)

### Step 5: Deploy contracts and wire everything

One command deploys contracts, propagates addresses, syncs ABI, rebuilds the SDK, and mints agent tokens:

```bash
# Testnet (deploys MockUSDT0 + X402PaymentVerifier, registers sellers, mints agent tokens)
npm run deploy:full

# Mainnet (deploys X402PaymentVerifier only, registers sellers)
npm run deploy:full:mainnet
```

This compiles contracts, deploys them, then runs `scripts/post-deploy.sh`, which automatically:

1. **Reads** the deploy manifest (`deploy-manifest.json`) written by the deploy script
2. **Updates** root `.env` with the new contract and token addresses (testnet or mainnet)
3. **Regenerates** `apps/web/.env.local` from root `.env` (all `NEXT_PUBLIC_*` vars)
4. **Syncs** the ABI from compiled Hardhat artifacts to `packages/x402-sdk/src/abi.ts`
5. **Rebuilds** the x402-sdk (`dist/`) so all apps pick up the new ABI immediately
6. **Mints** 100 USDT0 to the agent wallet (testnet only, if `AGENT_PRIVATE_KEY` is set)
7. **Validates** that all addresses are consistent across `.env`, `apps/web/.env.local`, and the deploy manifest

No manual address copying needed. The deploy output shows exactly what was deployed and where.

> **Multi-network:** The backend supports both chains simultaneously. The frontend sends an `x-chain-id` header to select which network to use per request. Deploy to each network separately. The `_TESTNET` and `_MAINNET` suffixed env vars coexist in the same `.env` file. See [Environment Variables Reference](#environment-variables-reference).

> **Re-deploying:** Just run `npm run deploy:full` again. It overwrites the previous addresses everywhere. Restart dev servers after re-deploying.

### Step 6: (Optional) Set up additional env vars

- **WalletConnect Project ID** — Get a free one at [https://cloud.walletconnect.com/](https://cloud.walletconnect.com/) and set `NEXT_PUBLIC_WC_PROJECT_ID`. The frontend works without it, but wallet connection will be limited.
- **Admin Dashboard** — The admin dashboard authenticates via wallet signature (the seller wallet). No shared secret is needed. For programmatic/CI access to admin endpoints, set `ADMIN_API_KEY` and pass it as the `x-admin-key` header.
- **LLM API Key** — Set `OPENAI_API_KEY` if you want to use the AI agent. Any OpenAI-compatible provider works (see [LLM provider](#llm-provider) section).

### Step 7: Start the applications

Dev mode uses an **in-memory store** — no Postgres, Redis, or Docker required.

```bash
# Terminal 1: Start the Seller API (in-memory mode)
npm run dev:api:local

# Terminal 2: Start the Web Frontend
npm run dev:web

# Terminal 3 (optional): Run the AI Agent
npm run dev:agent
```

### Step 8: Verify everything works

| Service | URL | What to check |
|---------|-----|---------------|
| **Seller API** | [http://localhost:4000/health](http://localhost:4000/health) | Should return `{ "status": "ok" }` |
| **Web Frontend** | [http://localhost:3000](http://localhost:3000) | Should show the endpoint catalog and wallet connect button |
| **Free endpoint** | [http://localhost:4000/data/free](http://localhost:4000/data/free) | Should return free data (no payment required) |
| **Premium endpoint** | [http://localhost:4000/data/premium](http://localhost:4000/data/premium) | Should return **402 Payment Required** with x402 headers |

### Step 9: Test the full payment flow

1. Open [http://localhost:3000](http://localhost:3000) in your browser
2. Verify the network badge shows **TESTNET (71)** in the header (click it to toggle between testnet and mainnet)
3. Connect your wallet (MetaMask or similar)
4. Switch your wallet to **Conflux eSpace Testnet** (chain ID 71)
5. Click "Mint Test USDT0" to get MockUSDT0 tokens (testnet only)
6. Click a premium endpoint (e.g. "Premium Data")
7. The paywall modal appears showing the price, token, and network. Sign the EIP-712 authorization (gasless, no transaction fee for you)
8. The facilitator settles the payment on-chain and you receive the premium data
9. Check the **Admin** page to see analytics, escrowed funds, and transaction history

You can also run the **preflight check** to verify your configuration:
```bash
npm run preflight
```

### Quick Demo (curl)

With the dev server running (`npm run dev:api:local`), try these three commands to see x402 in action:

```bash
# 1. Free endpoint — no payment needed
curl http://localhost:4000/data/free

# 2. Premium endpoint — returns 402 with payment challenge headers
curl -i http://localhost:4000/data/premium
# Look for: HTTP/1.1 402, x-payment-amount, x-payment-invoice-id, x-payment-nonce, etc.

# 3. Check invoice status (use the invoice ID from step 2)
curl http://localhost:4000/invoices/<invoice-id-from-step-2>
```

To complete a payment via curl, use the dev helper endpoint (dev mode only):
```bash
# Mark an invoice as paid (simulates on-chain settlement)
curl -X POST http://localhost:4000/invoices/<invoice-id>/dev-pay

# Now re-fetch premium data with the paid invoice
curl -H "x-payment-invoice-id: <invoice-id>" http://localhost:4000/data/premium
```

---

## Alternative: Docker (Production Mode)

Production mode uses Postgres + Redis for persistent storage.

### Full stack via Docker Compose
```bash
docker compose up --build
```
This starts: Postgres, Redis, Seller API (port 4000), Web UI (port 3000).

### With the AI agent
```bash
docker compose --profile agent up --build
```

### With monitoring (Prometheus + Grafana)
```bash
docker compose --profile monitoring up --build
```
- Prometheus: [http://localhost:9090](http://localhost:9090)
- Grafana: [http://localhost:3001](http://localhost:3001) (admin / x402admin)

### Hybrid: local code + Docker databases
```bash
# Terminal 1: Start Postgres + Redis via Docker
docker compose up postgres redis

# Terminal 2: Migrate DB & start API
npm run db:migrate
npm run dev:api

# Terminal 3: Start frontend
npm run dev:web
```

---

## Project Structure

```
├── packages/
│   ├── shared/          # Types, constants, token addresses, x402 headers
│   ├── x402-sdk/        # EIP-712 signing client + on-chain settlement verifier
│   └── contracts/       # MockUSDT0 + X402PaymentVerifier (Solidity + Hardhat)
├── apps/
│   ├── seller-api/      # Hono REST server with x402 middleware, settlement, admin
│   ├── web/             # Next.js 14 frontend — wallet connect, paywall UI, admin dashboard
│   └── agent/           # LangChain AI agent + MCP server for Claude integration
├── docs/
│   ├── architecture.md  # Mermaid system diagram & component table
│   ├── sequence.md      # Payment flow sequence diagrams
│   ├── runbooks.md      # Operational guides (rotate keys, pricing, disputes)
│   └── SECURITY.md      # Threat model & hardening recommendations
├── monitoring/          # Prometheus + Grafana configs & dashboards
├── postman/             # Postman API collection for manual testing
├── scripts/
│   ├── post-deploy.sh   # Auto-wires addresses, ABI, SDK after contract deploy
│   ├── mint-agent-tokens.ts # Mints test USDT0 to agent wallet (testnet)
│   └── preflight.sh     # Pre-deployment config verification
├── docker-compose.yml
└── .github/workflows/   # CI pipeline
```

---

## x402 Payment Flow (ERC-3009)

1. Client calls a premium endpoint (e.g. `GET /data/premium`)
2. Server responds **402 Payment Required** with headers: amount, token address, nonce, expiry, recipient, invoice ID
3. Client signs an **EIP-712 `ReceiveWithAuthorization`** message off-chain (no gas cost to buyer)
4. Client POSTs the signed authorization to `/invoices/:id/settle`
5. **Facilitator** (seller's service wallet) submits the authorization on-chain via `X402PaymentVerifier.settle()`, paying gas
6. Server verifies payment and returns premium data

> Buyers never pay gas — only the seller's facilitator does.

See [`docs/sequence.md`](docs/sequence.md) for detailed Mermaid sequence diagrams covering the happy path, agent flow, refund flow, and invoice expiry.

## Supported Tokens

| Token | Peg | Testnet Address | Mainnet Address | Standard |
|-------|-----|-----------------|-----------------|----------|
| **USDT0** | USD | `0x637B87C22d85Cd5f4C95d09d77c29130947C5A93` (MockUSDT0) | `0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff` | OFT (LayerZero) |
| **CNHT0 (AxCNH)** | CNH | — | `0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e` | OFT (LayerZero) |

Both tokens support ERC-3009 (`transferWithAuthorization` / `receiveWithAuthorization`) for gasless payment signing on Conflux eSpace. For testnet development (chain 71), a `MockUSDT0` contract is provided with the same ERC-3009 interface and a public `mint()` function. On mainnet (chain 1030), both USDT0 and CNHT0 are available as payment options.

> **Note:** The CNHT0 token's on-chain EIP-712 domain name is `"AxCNH"` (version `"2"`). The SDK auto-detects the correct domain via `getERC3009Domain()`.

---

## Smart Contracts

### MockUSDT0
ERC-20 token with full ERC-3009 support for testnet. Implements `transferWithAuthorization`, `receiveWithAuthorization`, and `cancelAuthorization`. Anyone can `mint()` on testnet.

### X402PaymentVerifier
Facilitator contract that settles ERC-3009 payments. The `settle()` function:
- Validates the token is supported
- Calls `receiveWithAuthorization()` on the token (transfers from buyer → verifier contract)
- Records invoice metadata (payer, amount, endpoint, nonce)
- Enforces replay protection via nonce tracking
- Accepts a per-settlement `escrowDuration` parameter (0 = use seller's default, otherwise override for this payment)
- Holds funds in escrow for a **configurable grace period** (default 24h, min 0s for instant release, max 30 days per seller/endpoint) before release to the seller
- `release()` is permissionless (anyone can call it after escrow expires)
- `refund()` is seller-only during the escrow period, enabling buyer protection

Deploy contracts and wire everything (addresses, ABI, SDK, agent tokens):
```bash
npm run deploy:full          # testnet
npm run deploy:full:mainnet  # mainnet
```

Run contract tests:
```bash
npm run contracts:test
```

---

## API Endpoints

### Public
| Endpoint | Method | Tier | Price |
|---|---|---|---|
| `/health` | GET | Free | — |
| `/data/free` | GET | Free | — |
| `/data/instant` | GET | Premium | 0.01 USDT0 |
| `/data/premium` | GET | Premium | 0.10 USDT0 |
| `/compute/simulate` | POST | Premium | 0.50 USDT0 |

### Invoices
| Endpoint | Method | Description |
|---|---|---|
| `/invoices` | GET | List invoices |
| `/invoices/:id` | GET | Get invoice by ID |
| `/invoices/:id/settle` | POST | Submit ERC-3009 signed authorization |
| `/invoices/:id/verify` | POST | Verify a settled invoice |
| `/invoices/:id/dev-pay` | POST | Dev helper: simulate payment without signing |

### Sellers
| Endpoint | Method | Description |
|---|---|---|
| `/sellers` | GET | List registered sellers |
| `/sellers/:address` | GET | Get seller info |

### Admin (requires `X-Admin-Key` header)
| Endpoint | Method | Description |
|---|---|---|
| `/admin/pricing` | GET | List all endpoint pricing |
| `/admin/pricing/:endpoint` | PUT | Set endpoint price |
| `/admin/analytics` | GET | Revenue and request stats |
| `/admin/analytics/export` | GET | Export analytics as CSV |
| `/admin/keys` | GET/POST | Manage API keys |
| `/admin/agent/:address/status` | GET | Check agent pause status |
| `/admin/agent/:address/pause` | POST | Pause an agent's spending |
| `/admin/agent/:address/resume` | POST | Resume a paused agent |
| `/invoices/:id/release` | POST | Release escrowed funds after the escrow grace period |

### Disputes
| Endpoint | Method | Description |
|---|---|---|
| `/disputes` | POST | Submit a dispute (`{ invoiceId, requester, reason }`) |
| `/disputes/:id` | GET | Get dispute details |
| `/disputes` | GET | List all disputes (admin, supports `?status=open`) |
| `/disputes/:id/resolve` | POST | Resolve dispute (`{ resolution: "approved"\|"rejected", adminNote? }`) |

### Agent Chat (dev mode)
| Endpoint | Method | Description |
|---|---|---|
| `/agent/chat` | POST | Send a message to the dev agent (`{ message, sessionId? }`) |
| `/agent/chat/:sessionId` | GET | Retrieve chat history for a session |

A [Postman collection](postman/x402-collection.json) is included for manual API testing.

---

## Web Frontend

The frontend at `http://localhost:3000` includes:

- **Network switching** — Click the badge in the header to toggle between **Testnet (71)** and **Mainnet (1030)**. All API calls, contract addresses, token addresses, and explorer links update automatically. No `.env` changes needed.
- **Home page** — Endpoint catalog with live pricing, wallet connection (ConnectKit), paywall modal with EIP-712 signing, multi-token support (USDT0 + CNHT0 on mainnet), transaction history with dispute submission, MockUSDT0 mint button (testnet only)
- **Seller directory** — Browse registered API sellers, search by wallet/URL/endpoint, view endpoint details and pricing per network
- **Admin dashboard** (`/admin`) — Analytics cards, endpoint pricing table with add/edit form, escrowed funds management with release confirmation modal, dispute review panel (approve refund / reject), agent chat panel, agent controls (pause/resume by wallet address), CSV export
- **Architecture page** (`/architecture`) — Interactive system diagram

---

## AI Agent

The LangChain-powered agent has 7 tools:
- `health_check` — Check API health
- `get_free_data` — Fetch free network metrics
- `get_premium_data` — Access premium data (auto-pays 402 challenges)
- `run_compute_simulation` — Run compute simulation (auto-pays 402 challenges)
- `list_endpoints` — List available endpoints and pricing
- `get_analytics` — Fetch admin analytics
- `check_budget` — Check remaining spend budget

### Agent run modes
```bash
npm run dev:agent        # LangChain agent with autonomous payment (default)
npm run mcp:agent        # MCP server for Claude Desktop / Claude Code integration
```

### Safety controls
- Per-transaction spend cap (default: 10 USDT0)
- Daily budget limit (default: 5 USDT0)
- Max retry attempts per 402 challenge
- Admin can pause/resume agents via API or web UI

### LLM provider
The agent works with any OpenAI-compatible API. Set `OPENAI_API_BASE` and `LLM_MODEL` in `.env`:
- OpenAI: `OPENAI_API_BASE=https://api.openai.com/v1` / `LLM_MODEL=gpt-4o-mini`
- Kimi: `OPENAI_API_BASE=https://api.moonshot.ai/v1` / `LLM_MODEL=kimi-k2-0905-preview`
- DeepSeek: `OPENAI_API_BASE=https://api.deepseek.com/v1` / `LLM_MODEL=deepseek-chat`

---

## Environment Variables Reference

See [`.env.example`](.env.example) for a copy-pasteable template with comments.

### Required (all modes)

| Variable | Description | Example |
|----------|-------------|---------|
| `NETWORK` | `testnet` or `mainnet` | `testnet` |
| `SERVICE_WALLET_KEY` | Facilitator private key (pays gas for settlements) | `0x...` |
| `SERVICE_WALLET_ADDRESS` | Facilitator public address | `0x...` |
| `X402_CONTRACT_ADDRESS` | Default X402PaymentVerifier address (legacy fallback) | `0x...` |
| `USDT0_ADDRESS` | Default token address (legacy fallback) | `0x...` |

### Per-network contracts (multi-network support)

The backend supports both chains simultaneously. The frontend sends `x-chain-id` to select the network per request.

| Variable | Description |
|----------|-------------|
| `X402_CONTRACT_ADDRESS_TESTNET` | Verifier contract on testnet (chain 71) |
| `X402_CONTRACT_ADDRESS_MAINNET` | Verifier contract on mainnet (chain 1030) |
| `USDT0_ADDRESS_TESTNET` | MockUSDT0 on testnet |
| `USDT0_ADDRESS_MAINNET` | Real USDT0 on mainnet |
| `CNHT0_ADDRESS` | CNHT0 on mainnet (additional payment token) |

### Frontend

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_BASE` | Seller API URL | `http://localhost:4000` |
| `NEXT_PUBLIC_USDT0_ADDRESS` | Testnet MockUSDT0 address (for mint button) | `0x...` |
| `NEXT_PUBLIC_X402_CONTRACT_ADDRESS` | Default verifier address | `0x...` |
| `NEXT_PUBLIC_X402_CONTRACT_ADDRESS_TESTNET` | Testnet verifier address | `0x...` |
| `NEXT_PUBLIC_X402_CONTRACT_ADDRESS_MAINNET` | Mainnet verifier address | `0x...` |
| `NEXT_PUBLIC_NETWORK` | Default network shown before wallet connects | `testnet` |
| `NEXT_PUBLIC_SERVICE_WALLET_ADDRESS` | Facilitator/seller wallet address | `0x...` |
| `NEXT_PUBLIC_WC_PROJECT_ID` | WalletConnect project ID ([get one free](https://cloud.walletconnect.com/)) | `abc123...` |

### AI Agent (optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `AGENT_PRIVATE_KEY` | Agent wallet private key (separate from service wallet) | `0x...` |
| `OPENAI_API_KEY` | LLM API key (any OpenAI-compatible provider) | `sk-...` |
| `OPENAI_API_BASE` | LLM API base URL | `https://api.openai.com/v1` |
| `LLM_MODEL` | LLM model name | `gpt-4o-mini` |
| `AGENT_SPEND_CAP` | Max total spend in USDT0 smallest unit (6 decimals) | `10000000` (= 10 USDT0) |
| `AGENT_DAILY_BUDGET` | Daily budget in USDT0 smallest unit | `5000000` (= 5 USDT0) |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `CHAIN_ID` | Fallback chain ID when requests omit `x-chain-id` header (frontend always sends it) | `71` |
| `API_PORT` | Seller API port | `4000` |
| `ADMIN_API_KEY` | API key for programmatic admin access (dashboard uses wallet auth) | _(empty)_ |
| `DATABASE_URL` | PostgreSQL connection string (production mode only) | _(in-memory in dev)_ |
| `REDIS_URL` | Redis connection string (production mode only) | _(disabled in dev)_ |
| `LOG_LEVEL` | Logging level (`debug`, `info`, `warn`, `error`) | `info` |
| `ALERT_WEBHOOK_URL` | Slack/Discord webhook for alerts | _(disabled)_ |

---

## Testing

```bash
# All tests (contracts + API + agent + frontend)
npm test

# Contract tests (ERC-3009 settlement flow)
npm run contracts:test

# API tests
npm run test -w apps/seller-api

# Agent tests (spend tracking, 402 payment flow)
npm run test -w apps/agent

# Frontend tests (paywall modal, endpoint catalog, API client)
npm run test -w apps/web
```

---

## Security Audits

Two independent audit cycles were performed on the `X402PaymentVerifier` smart contract.

### Audit 1 — March 29, 2026

Initial audit using 7 parallel specialist agents covering access control, signatures, ERC-20 interactions, DoS, precision/math, chain-specific issues, and general security. Full report: [`audits/x402-2026-03-29/AUDIT-REPORT.md`](audits/x402-2026-03-29/AUDIT-REPORT.md).

### Audit 2 — April 2, 2026

Follow-up audit after code refinements. Same methodology (7 specialist agents, 500+ checklist items).

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 6 |
| Low | 8 |
| Info | 7 |

**Key medium findings** (design trade-offs, not bugs):
- **M-1**: Seller can redirect refunds via `refundTo()` — mitigated by trust model (seller is API operator)
- **M-2**: Token blocklist can lock escrowed funds — edge case for USDT-style blocklists post-settlement
- **M-3**: No chain-ID binding in invoiceId — cross-chain replay possible in theory, mitigated by separate contract deployments

**Conclusion**: No critical or high severity issues. The contract follows established patterns (CEI ordering, ReentrancyGuard, Ownable2Step, SafeERC20) and delegates signature verification to the ERC-3009 token contract. All findings are acceptable for an experimental boilerplate.

Full report: [`audits/x402-20260402/AUDIT-REPORT.md`](audits/x402-20260402/AUDIT-REPORT.md).

---

## Acceptance Criteria

All acceptance criteria from the [bounty spec](spec.md) are met:

| Criterion | Status |
|-----------|--------|
| Seller endpoints enforce x402: free endpoints open, premium return 402 until paid | Done |
| Web client connects wallet, views invoice, confirms payment, auto-fetches data | Done |
| AI agent detects 402, submits payment on testnet, retries within <30s | Done |
| Logging + analytics show per-endpoint usage, revenue, agent spend caps | Done |
| Full stack spins up locally via `docker compose up` | Done |
| Payment proof bound to request scope (nonce/expiry + endpoint) with replay protection | Done |
| End-to-end flow works with demo scripts and docs | Done |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm install` fails | Make sure you're on Node.js 18+. Run `node -v` to check. |
| Contract deployment fails | Ensure `SERVICE_WALLET_KEY` has testnet CFX. Get some from [the faucet](https://efaucet.confluxnetwork.org/). |
| 402 settlement fails with "insufficient funds" | The facilitator wallet needs CFX for gas. Top up at the faucet. |
| Frontend can't connect to API | Check that `NEXT_PUBLIC_API_BASE` is `http://localhost:4000` and the API is running. |
| Wallet won't connect | Make sure you're on Conflux eSpace Testnet (chain ID 71). Add the network to MetaMask if needed: RPC `https://evmtestnet.confluxrpc.com`, Chain ID `71`, Currency `CFX`. |
| Agent errors on startup | Verify `OPENAI_API_KEY` and `AGENT_PRIVATE_KEY` are set in `.env`. |
| "Cannot find module" errors | Run `npm install` from the project root — this is an npm workspaces monorepo. |
| Port already in use | Another process is using port 4000 or 3000. Kill it or change `API_PORT` in `.env`. |
| Wrong token address on paywall | Re-run `npm run deploy:full` to re-sync all addresses, then restart dev servers. If you edited `apps/web/.env.local` manually, delete it and re-run `deploy:full` (it's auto-generated). |
| Escrow release fails | The smart contract enforces a configurable escrow period (default 24h, can be 0-30 days per endpoint). There is no admin bypass. Wait for the period to expire, then release from the Admin page. |

Run the **preflight check** to diagnose configuration issues:
```bash
npm run preflight
```

---

## Further Reading

- [`docs/architecture.md`](docs/architecture.md) — System diagram and component overview
- [`docs/sequence.md`](docs/sequence.md) — Payment flow sequence diagrams (happy path, agent, refund, expiry)
- [`docs/runbooks.md`](docs/runbooks.md) — Operational guides (rotate keys, adjust pricing, handle disputes)
- [`docs/SECURITY.md`](docs/SECURITY.md) — Threat model and hardening recommendations
- [`spec.md`](spec.md) — Original bounty specification and acceptance criteria

## License

MIT
