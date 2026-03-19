# Conflux Automation Site (CAS)

> **Live:** https://cas.cfxdevkit.org

Non-custodial limit order and DCA (dollar-cost averaging) automation on
**Conflux eSpace** — users sign strategies once with their wallet; a keeper
network executes trades autonomously without ever holding private keys.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                          │
│  Next.js 14 App Router  (port 3000)                             │
│  • Connect Wallet (wagmi + MetaMask/WalletConnect)              │
│  • SIWE sign-in → JWT stored in localStorage                    │
│  • Create limit-order / DCA strategy                            │
│  • Live dashboard via SSE (EventSource)                         │
│  • Safety panel — admin pause/resume                             │
└───────────────────┬─────────────────────────────────────────────┘
                    │  /api/*  (App Router catch-all proxy)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Express Backend  (port 3001)                   │
│  REST  POST /auth/challenge | /auth/verify                      │
│        POST /jobs              (create strategy)                │
│        GET  /jobs              (list user jobs)                 │
│        GET  /jobs/:id          (single job)                     │
│        DELETE /jobs/:id        (cancel job)                     │
│        GET  /admin/status      (pause state)                    │
│        POST /admin/pause       (admin only)                     │
│        POST /admin/resume      (admin only)                     │
│  SSE   GET  /events            (real-time job updates)          │
│  SQLite database via better-sqlite3                             │
└───────────────────┬─────────────────────────────────────────────┘
                    │  Shared SQLite file (/data/cas.db)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│               Keeper Worker  (background process)               │
│  Poll pending jobs → check price oracle → call executeJob()     │
│  on AutomationManager Solidity contract via EXECUTOR_PRIVATE_KEY│
│  (keeper wallet does NOT hold user funds)                       │
└───────────────────┬─────────────────────────────────────────────┘
                    │  on-chain
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│          AutomationManager.sol  (Conflux eSpace Testnet)        │
│  • registerJob / cancelJob / executeJob                         │
│  • Slippage guard (minAmountOut)                                 │
│  • Non-custodial: users pre-approve token allowance only        │
└─────────────────────────────────────────────────────────────────┘
```

### Packages

| Package | Description |
|---------|-------------|
| `shared` | Shared TypeScript types and Zod schemas |
| `contracts` | Hardhat project — `AutomationManager.sol` + deployment scripts |
| `backend` | Express API server + SQLite persistence + SSE event stream |
| `worker` | Keeper daemon — polls jobs, checks prices, submits on-chain txs |
| `frontend` | Next.js 14 App Router frontend (wagmi, viem, Tailwind CSS) |

---

## Prerequisites

- **Node.js ≥ 18**, **pnpm ≥ 8**
- **MetaMask** (or any EIP-1193 wallet) with some testnet CFX
  - Add network: Conflux eSpace Testnet, Chain ID `71`, RPC `https://evmtestnet.confluxrpc.com`
  - Faucet: <https://faucet.confluxnetwork.org/>
- (Optional) WalletConnect Project ID from <https://cloud.walletconnect.com>

---

## Quick Start (Local Dev)

### 1 — Clone and install

```bash
git clone <repo-url> conflux-cas
cd conflux-cas
pnpm install
```

### 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env` — at minimum set:

```dotenv
JWT_SECRET=<run: openssl rand -hex 32>
# For the worker to execute on-chain (optional for UI testing):
# EXECUTOR_PRIVATE_KEY=<64-char hex, no 0x>
# AUTOMATION_MANAGER_ADDRESS=<deployed contract address>
```

All other defaults work for local development.

### 3 — Start the backend

```bash
# Terminal 1
pnpm run dev:backend
# → http://localhost:3001
```

### 4 — Start the frontend

```bash
# Terminal 2
pnpm run dev:frontend
# → http://localhost:3000
```

### Alternative — start all services concurrently

If you prefer a single command to launch backend, frontend, and worker together during development, use the root `dev` script which runs all three in parallel (uses `concurrently`):

```bash
# single terminal
pnpm dev
# → runs backend, frontend, worker concurrently with coloured prefixes
```

### 5 — Open the app

Visit <http://localhost:3000>, connect your MetaMask wallet, and sign in.
 
> **Note:** The backend and worker share the same SQLite file (`./data/cas.db`).
> 
> **Dashboard:** The Dashboard now displays strategies in a compact horizontal table (`JobRow` per strategy) and receives live updates via Server-Sent Events. Token symbols/decimals are resolved from a local `cas_pool_meta_v1` cache (no extra RPC on render). The SSE client auto-reconnects on error (5s) and there is a 30s fallback poll to re-fetch jobs in case events are missed.
> The worker is optional for UI testing — jobs will be created and listed but
> not executed on-chain until the worker is running.

### (Optional) Start the worker

```bash
# Terminal 3 — requires EXECUTOR_PRIVATE_KEY + deployed contract
pnpm run dev:worker
```

---

## Recent changes (developer notes)

- Persist JWT across page refreshes: `AuthProvider` now avoids clearing the stored
  JWT on initial client mount so users remain signed in when the page reloads.
- Worker price-check improvements:
  - Defensive `factory.getPair` check before calling `getAmountsOut` to surface
    clear "no pool" errors when a pair doesn't exist.
  - Swappi price normalization: prices are now returned scaled to 1e18 using
    token decimals so comparisons with 1e18-scaled `targetPrice` values are
    correct (fixes mismatches for tokens with non-18 decimals such as USDT).
  - Executor logs execution-time `currentPrice`/`targetPrice` for debugging.

These fixes are in `worker/src/main.ts` and `frontend/src/lib/auth-context.tsx`.


---

## User Flow

```
1. Go to http://localhost:3000
2. Click "Connect Wallet" → approve MetaMask popup
3. Click "Sign In" → sign the SIWE message (no gas, off-chain)
4. Click "Create Strategy" in the nav
5. Fill in: token pair, amount, target price (limit order) or interval (DCA)
6. Submit → strategy appears on the Dashboard as "pending"
7. When price conditions are met, the keeper executes the trade
8. Dashboard updates in real-time via Server-Sent Events
9. Safety page → toggle Global Pause to halt all keeper activity
```

---

## Running Tests

```bash
# Individual packages
pnpm --filter @conflux-cas/backend test   # 16 integration tests
pnpm --filter @conflux-cas/worker test    # 40 unit tests
pnpm --filter @cfxdevkit/sdk test         # 85 unit tests
pnpm contracts:test                       # 57 Hardhat tests

# Coverage (requires NODE_PATH for workspace-root coverage provider)
NODE_PATH=/path/to/repos/node_modules pnpm --filter @conflux-cas/worker test --coverage
NODE_PATH=/path/to/repos/node_modules pnpm --filter @conflux-cas/backend test --coverage

# Type-check all packages
pnpm type-check
```

### Test Summary

| Package | Tests | Coverage (statements) | Notes |
|---------|-------|-----------------------|-------|
| `@conflux-cas/backend` | 16 ✅ | 33% overall · 79% jobs routes · 85% db | Low overall due to `pools.ts`/`system.ts` (external RPC, no mocks) |
| `@conflux-cas/worker` | 40 ✅ | **94%** | executor + safety-guard fully covered |
| `@cfxdevkit/sdk` | 85 ✅ | ~80% automation module | High on automation; wallet/keystore features untested |
| Solidity contracts | 57 ✅ | >90% line coverage | Hardhat + OpenZeppelin; all paths covered |
| **Total** | **198** | — | All 198 tests pass |

---

## Contract Deployment

### Pre-flight check

```bash
# Validate private key, derive deployer address, show live CFX balance
pnpm contracts:check-wallet
```

Requires `DEPLOYER_PRIVATE_KEY` in `.env`. Needs ≥ 0.1 CFX (testnet) / ≥ 0.5 CFX (mainnet).

### Testnet

```bash
# run from monorepo root
pnpm contracts:deploy
# Outputs deployed addresses — copy them to .env
```

### Mainnet

```bash
pnpm contracts:deploy:mainnet
# Prints a ready-to-paste .env snippet after a successful deploy
```

### Compile + regenerate SDK types

```bash
# Compiles Solidity and regenerates conflux-sdk/src/automation/generated.ts
# (ABIs, bytecode, per-chain address maps)
pnpm contracts:codegen
```

---

## Deployed Contracts

### eSpace Mainnet (chain ID 1030)

| Contract | Address |
|---|---|
| `AutomationManager` | `0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F` |
| `SwappiPriceAdapter` | `0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9` |
| `PermitHandler` | `0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B` |
| Swappi V2 Router | `0xE37B52296b0bAA91412cD0Cd97975B0805037B84` |
| Swappi V2 Factory | `0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5` (from `router.factory()`; prev `0x20b45b8a...` had no code) |

### eSpace Testnet (chain ID 71)

| Contract | Address |
|---|---|
| `AutomationManager` | `0x33e5e5b262e5d8ebc443e1c6c9f14215b020554d` |
| `SwappiPriceAdapter` | `0x88c48e0e8f76493bb926131a2be779cc17ecbedf` |
| `PermitHandler` | `0x4240882f2d9d70cdb9fbcc859cdd4d3e59f5d137` |
| Swappi V2 Router | `0x873789aaF553FD0B4252d0D2b72C6331c47aff2E` |
| Swappi V2 Factory | `0x36B83E0D41D1dd9C73a006F0c1cbC1F096E69E34` |

> Canonical addresses are committed in `conflux-contracts/deployments.json` and baked into the SDK via `pnpm contracts:codegen`.

---

## Contract Verification

```bash
pnpm contracts:verify           # testnet
pnpm contracts:verify:mainnet   # mainnet
```

> **⚠️ viaIR + ConfluxScan limitation**
>
> The contracts are compiled with `viaIR: true`. ConfluxScan's API has a known
> bug where it cannot match constructor arguments for viaIR-compiled bytecode,
> causing a `constructor_args_not_match` error for `AutomationManager` and
> `SwappiPriceAdapter`. This is a ConfluxScan backend limitation, not an error
> in the deployment.
>
> **Sourcify** (enabled in `hardhat.config.ts`) verifies correctly and produces
> `full_match` results. The verified sources are publicly accessible at:
>
> - [AutomationManager on Sourcify](https://repo.sourcify.dev/contracts/full_match/1030/0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F/)
> - [SwappiPriceAdapter on Sourcify](https://repo.sourcify.dev/contracts/full_match/1030/0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9/)
> - [PermitHandler on ConfluxScan](https://evm.confluxscan.org/address/0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B#code) ✅ (no constructor args → verifies fine)

---

## Docker Compose (Production-like)

> **Important:** the build context is the **parent `repos/` directory** so
> both `conflux-cas/` and `conflux-sdk/` are visible during the build.

```bash
# From inside conflux-cas/
cp .env.example .env
# (fill in JWT_SECRET, EXECUTOR_PRIVATE_KEY, AUTOMATION_MANAGER_ADDRESS)

docker compose up --build
# backend  → localhost:3001
# frontend → localhost:3000
```

Services communicate over Docker's internal network; the frontend proxies
`/api/*` to the backend via the App Router catch-all route handler.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Non-custodial** | Users pre-approve token allowance; keeper only calls `executeJob`, never holds funds |
| **SIWE authentication** | Standard wallet-based auth, no passwords; JWT valid 24 h |
| **SQLite + better-sqlite3** | Zero-dependency persistence, sync API, easy local dev; swap for Postgres in production |
| **SSE not WebSocket** | Simpler, works through HTTP/2, no socket management; read-only server→client stream |
| **App Router catch-all proxy** | `src/app/api/[...path]/route.ts` reliably intercepts `/api/*` before any page routing; avoids unreliable `next.config.cjs` rewrite ordering in dev |
| **Keeper is separate process** | Worker can be scaled, replaced, or paused independently from the API server |
| **Global Pause circuit breaker** | In-memory flag lets an admin halt all on-chain activity instantly without DB access |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | ✅ | — | 32-byte hex string for JWT signing |
| `DATABASE_PATH` | | `./data/cas.db` | SQLite file path |
| `PORT` | | `3001` | Backend HTTP port |
| `CORS_ORIGIN` | | `http://localhost:3000` | Allowed CORS origin(s) |
| `EXECUTOR_PRIVATE_KEY` | Worker only | — | Keeper wallet private key (no `0x`) |
| `NETWORK` | | `testnet` | `testnet` or `mainnet` |
| `AUTOMATION_MANAGER_ADDRESS` | Worker/Backend | see above | Deployed AutomationManager address |
| `PRICE_ADAPTER_ADDRESS` | Backend | see above | Deployed SwappiPriceAdapter address |
| `PERMIT_HANDLER_ADDRESS` | Backend | see above | Deployed PermitHandler address |
| `CONFLUX_ESPACE_TESTNET_RPC` | | `https://evmtestnet.confluxrpc.com` | Testnet RPC URL |
| `CONFLUX_ESPACE_MAINNET_RPC` | | `https://evm.confluxrpc.com` | Mainnet RPC URL |
| `DEPLOYER_PRIVATE_KEY` | Deploy scripts | — | Deployer wallet key (`0x`-prefixed) |
| `CONFLUXSCAN_API_KEY` | Verification | `no-key` | Get free key at evmapi.confluxscan.org |
| `BACKEND_URL` | Frontend prod | `http://localhost:3001` | Backend origin for proxy |
| `NEXT_PUBLIC_WC_PROJECT_ID` | | — | WalletConnect project ID |
| `NEXT_PUBLIC_NETWORK` | | `testnet` | Chain for wallet connection (`testnet`/`mainnet`) |
| `NEXT_PUBLIC_AUTOMATION_MANAGER_ADDRESS` | Frontend | see above | AutomationManager address exposed to browser |

---

## Project Structure

```
/repos/                              ← pnpm workspace root
├── conflux-sdk/                     # @cfxdevkit/sdk
│   └── src/automation/
│       ├── generated.ts             # auto-generated: ABIs + addresses + bytecode
│       ├── abi.ts                   # re-exports under UPPER_CASE + camelCase names
│       ├── types.ts                 # Job, SafetyConfig, etc.
│       ├── safety-guard.ts
│       ├── price-checker.ts
│       └── retry-queue.ts
├── conflux-contracts/               # @cfxdevkit/contracts (Hardhat)
│   ├── contracts/
│   │   ├── AutomationManager.sol
│   │   ├── SwappiPriceAdapter.sol
│   │   ├── PermitHandler.sol
│   │   └── interfaces/ + mocks/
│   ├── scripts/                     # deploy.ts, verify.ts, check-wallet.ts
│   ├── test/                        # 57 Hardhat tests (>90% coverage)
│   ├── deployments.json             # canonical on-chain addresses
│   └── wagmi.config.ts              # codegen → ../conflux-sdk/src/automation/generated.ts
└── conflux-cas/                     # application monorepo
    ├── shared/                      # thin re-exports of SDK types + Zod schemas
    ├── backend/src/
    │   ├── routes/                  # auth.ts, jobs.ts, admin.ts, sse.ts
    │   ├── services/                # job-service, keeper-client, admin-service
    │   └── db/                      # Drizzle ORM + SQLite schema
    ├── worker/src/
    │   ├── job-poller.ts            # schedules execution ticks
    │   ├── executor.ts              # on-chain tx via viem
    │   ├── price-checker.ts         # reads SwappiPriceAdapter on-chain
    │   ├── safety-guard.ts          # circuit breakers
    │   └── retry-queue.ts           # exponential back-off retry
    ├── frontend/src/app/
    │   ├── page.tsx                 # home + strategy creation modal
    │   ├── dashboard/               # live job table (SSE)
    │   ├── job/[id]/                # strategy detail + execution history
    │   ├── safety/                  # admin pause/resume panel
    │   └── status/                  # worker heartbeat
    └── docker-compose.yml
```

---

## Documentation

| File | Description |
|------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, layer reference, full API route table, DB schema, deployment notes |
| [docs/USER_MANUAL.md](docs/USER_MANUAL.md) | End-user guide — wallet setup, creating strategies, dashboard, safety panel |

---

## Troubleshooting

### Wallet / Sign-in

| Symptom | Fix |
|---------|-----|
| "Sign In" button does nothing | Make sure your wallet is on the correct network (Conflux eSpace Testnet chain ID `71` or Mainnet chain ID `1030`). MetaMask will show a network mismatch banner. |
| SIWE modal closes but auth fails | The nonce expires after 5 minutes. Refresh the page and try again. |
| "CORS error" in devtools console | The backend `CORS_ORIGIN` env var must match the exact origin (protocol + host + port). For local dev with HTTPS, add `https://localhost:3000` to the comma-separated list. |

### Strategy Creation

| Symptom | Fix |
|---------|-----|
| Transaction fails at "Approve" step | You may not have enough CFX to cover gas. Get testnet CFX from <https://faucet.confluxnetwork.org/>. |
| "Wrapping CFX → wCFX" step appears | This is expected when `tokenIn = CFX` and your wCFX balance is below the strategy amount. The app wraps the shortfall automatically before the approval. |
| Strategy stays in `pending` after creation | The worker may not be running. Check `/status` page — if "Worker Heartbeat" shows `stale`, restart the worker (`pnpm run dev:worker`). |
| "Price condition not met" in job errors | The target price hasn't been reached on-chain. This is the system working correctly; the job will execute when conditions are met. |

### Worker / Execution

| Symptom | Fix |
|---------|-----|
| Worker exits immediately | Check `EXECUTOR_PRIVATE_KEY` (no `0x` prefix) and `CONFLUX_RPC_URL` in `.env`. Run `pnpm contracts:check-wallet` to validate the key. |
| All jobs stuck in `active` with retries > 0 | The keeper wallet may be out of CFX for gas. Fund the `EXECUTOR_PRIVATE_KEY` address. |
| `PriceConditionNotMet` on every tick | Normal — the target price has not been reached. Check via `SwappiPriceAdapter.getPrice()` to confirm. |
| `JobNotActive` revert | The job was cancelled or already executed on-chain. The worker will sync the DB and mark it completed. |
| Circuit breaker trips (worker halts) | 5 consecutive execution errors triggered the safety halt. Check logs for the root cause, fix, then restart the worker. |

### Docker / Production

| Symptom | Fix |
|---------|-----|
| Backend container `unhealthy` | Run `docker compose logs backend` to see the error. Most common: missing env vars in `.env`. |
| Frontend shows blank page or 502 | nginx is not routing to the frontend container. Verify `docker compose ps` shows frontend `Up`. If deploying for the first time, wait ~30 s for containers to start. |
| `/api/` returns 404 | nginx `proxy_pass` needs a trailing slash: `proxy_pass http://127.0.0.1:3001/;` — the slash strips the `/api/` prefix before forwarding. |
| Token list won't load | The backend is fetching ~200+ Swappi pairs on first boot. This takes 10–30 s on testnet due to rate-limit-aware chunking. Wait and refresh. |
| `SSE events` not updating dashboard | Check browser devtools → Network → filter `events`. If the SSE connection is closed, the client auto-reconnects every 5 s. A 30 s fallback poll also runs independently. |

### Test Failures

```bash
# Reset the test database before running backend integration tests
pnpm --filter @conflux-cas/backend test

# If Hardhat tests fail with "nonce too low", reset the local node:
pnpm --filter @conflux-cas/contracts test --bail
```

---

## License

MIT — see [LICENSE](./LICENSE)
