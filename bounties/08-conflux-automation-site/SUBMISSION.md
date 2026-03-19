# Bounty #08 — Conflux Automation Site

**Bounty:** #08 — Conflux Automation Site ($1,000)  
**Submitted by:** [cfxdevkit](https://github.com/cfxdevkit)  
**Live deployment:** https://cas.cfxdevkit.org  
**Demo video:** [`conflux-automation-site/cas.mp4`](conflux-automation-site/cas.mp4)  
**License:** MIT

---

## Summary

A fully-functional, non-custodial limit-order and DCA automation site built on
**Conflux eSpace**.

Users connect their wallet, configure a strategy (limit sell/buy or recurring DCA),
sign an ERC-20 approval once, and a keeper worker executes trades automatically —
without ever holding private keys or user funds.

The project ships as a **monorepo** with four integrated layers:

| Directory | Description |
|---|---|
| [`conflux-automation-site/conflux-contracts/`](conflux-automation-site/conflux-contracts/) | Solidity 0.8.24 + OpenZeppelin 5, Hardhat — `AutomationManager`, `SwappiPriceAdapter`, `PermitHandler` |
| [`conflux-automation-site/conflux-cas/worker/`](conflux-automation-site/conflux-cas/worker/) | Node.js keeper daemon — polls jobs, checks DEX prices, submits on-chain txs |
| [`conflux-automation-site/conflux-cas/backend/`](conflux-automation-site/conflux-cas/backend/) | Express 5 REST API, Drizzle ORM, SQLite, SIWE auth, SSE event stream |
| [`conflux-automation-site/conflux-cas/frontend/`](conflux-automation-site/conflux-cas/frontend/) | Next.js 14 App Router, wagmi v2, Tailwind CSS |
| [`conflux-automation-site/conflux-sdk/`](conflux-automation-site/conflux-sdk/) | Shared SDK — `SafetyGuard`, `PriceChecker`, `RetryQueue`, automation ABI |

---

## Deployed Contracts

### Mainnet — Conflux eSpace (chain ID 1030)

| Contract | Address | Sourcify |
|---|---|---|
| `AutomationManager` | `0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F` | [full_match](https://repo.sourcify.dev/contracts/full_match/1030/0x9D5B131e5bA37A238cd1C485E2D9d7c2A68E1d0F/) |
| `SwappiPriceAdapter` | `0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9` | [full_match](https://repo.sourcify.dev/contracts/full_match/1030/0xD2Cc2a7Eb4A5792cE6383CcD0f789C1A9c48ECf9/) |
| `PermitHandler` | `0x0D566aC9Dd1e20Fc63990bEEf6e8abBA876c896B` | — |

### Testnet — Conflux eSpace Testnet (chain ID 71)

| Contract | Address |
|---|---|
| `AutomationManager` | `0x33e5e5b262e5d8ebc443e1c6c9f14215b020554d` |
| `SwappiPriceAdapter` | `0x88c48e0e8f76493bb926131a2be779cc17ecbedf` |
| `PermitHandler` | `0x4240882f2d9d70cdb9fbcc859cdd4d3e59f5d137` |

---

## Getting Started

```bash
# From the project root
cd conflux-automation-site
pnpm install

# Start all services concurrently (backend + frontend + worker)
cd conflux-cas
pnpm dev
```

See [`conflux-automation-site/conflux-cas/README.md`](conflux-automation-site/conflux-cas/README.md) for the full setup guide, Docker Compose instructions, and environment variable reference.

---

## Deliverable Checklist

### 1  Strategy Builder ✅

- Limit-order form (buy/sell, target price, slippage, expiry)
- DCA form (interval, amount-per-swap, total-swaps, token pair)
- Real-time price preview from Swappi DEX oracle
- Market / +1% / +5% / +10% price presets; per-pair field reset
- 4-step transaction stepper: wrap CFX → approve token → register on-chain → save to DB
- Client-side Zod validation before any wallet call

### 2  Smart Contracts ✅

- `AutomationManager.sol` — `createJob`, `cancelJob`, `executeJob`, `executeDCATick`
- OpenZeppelin `Pausable` (global pause) + `ReentrancyGuard`
- On-chain slippage guard (`amountOut >= minAmountOut`)
- On-chain price condition check via `SwappiPriceAdapter`
- Per-job allowance: contract calls `safeTransferFrom(owner, …)` at execution only
- **57 Hardhat tests, >90% line coverage**

### 3  Execution Worker ✅

- `JobPoller` — configurable `setInterval` tick loop (default 15 s)
- `PriceChecker` — `getAmountsOut` from Swappi V2 router on Conflux eSpace
- `Executor` — routes `limit_order` / `dca` jobs; handles all transient/terminal errors
- `KeeperClientImpl` — `simulateContract` before every `writeContract` (fail-fast)
- `RetryQueue` — exponential back-off; configurable `maxRetries` (default 5)
- `DRY_RUN=true` mode for staging evaluation without real transactions
- **40 unit tests, 94% statement coverage**

### 4  Safety Controls ✅ _(priority deliverable)_

> Defence is layered across off-chain guards, on-chain contract checks, and process
> hardening. The keeper wallet has **executor role only** — it cannot move user tokens
> independently.

| Control | Layer | Detail |
|---|---|---|
| **Global pause (off-chain)** | `SafetyGuard` + DB | Reads `settings.paused` each tick; halts all execution immediately |
| **Global pause (on-chain)** | `preflightCheck()` | Reads `AutomationManager.paused()` before **every** transaction |
| **Gas price circuit-breaker** | `preflightCheck()` | Aborts if `gasPrice > MAX_GAS_PRICE_GWEI` (default 1000 gwei) |
| **RPC timeout (`AbortController`)** | `withTimeout()` in `KeeperClientImpl` | All `readContract` / `simulateContract` / `writeContract` get individual `AbortController` guards; configurable via `WORKER_RPC_TIMEOUT_MS` (default 2 min) |
| **Swap USD cap** | `SafetyGuard.check()` | Rejects swap when `swapUsd > maxSwapUsd` (default $10,000) |
| **Slippage guard** | On-chain + off-chain | Contract enforces `minAmountOut`; `SafetyGuard` caps `maxSlippageBps` at 500 bps |
| **Retry cap** | `SafetyGuard.check()` | Blocks execution once `retries >= maxRetries` |
| **Transient skip (no retry burn)** | `Executor.processTick()` | `PriceConditionNotMet` / `DCAIntervalNotReached` → silent skip, retries NOT decremented |
| **DCA 15-second buffer** | `PriceChecker.checkDCA()` | Requires `now >= nextExecution + 15 s` before submitting; prevents boundary reverts |
| **DB/on-chain sync (`JobNotActive`)** | `Executor.processTick()` | Re-queries chain status and sets DB to `executed` or `cancelled` correctly |
| **Non-root process guard** | `main.ts` | Refuses to start as `UID 0`; exits with an error log |
| **Crash diagnostics** | `main.ts` | `unhandledRejection` + `uncaughtException` hooks log full stack, then exit cleanly |
| **Private key redaction** | `main.ts` startup log | `EXECUTOR_PRIVATE_KEY` replaced with `[REDACTED]` in all structured logs |

### 5  Docs & Tests ✅

- [`conflux-automation-site/conflux-cas/README.md`](conflux-automation-site/conflux-cas/README.md) — setup, quick-start, env vars, troubleshooting
- [`conflux-automation-site/conflux-cas/docs/ARCHITECTURE.md`](conflux-automation-site/conflux-cas/docs/ARCHITECTURE.md) — system diagram, layer reference, API routes, DB schema, Safety Controls reference table, deployment guide
- [`conflux-automation-site/conflux-cas/docs/USER_MANUAL.md`](conflux-automation-site/conflux-cas/docs/USER_MANUAL.md) — end-user guide
- [`conflux-automation-site/DEPLOY.md`](conflux-automation-site/DEPLOY.md) — Docker Compose and cloud deployment guide
- **198 total tests** (57 Solidity + 40 worker + 87 SDK + 16 backend)

---

## Running Tests

```bash
cd conflux-automation-site

# Smart contract tests (Hardhat + coverage)
cd conflux-contracts && npx hardhat test && npx hardhat coverage

# Worker unit tests — 40 tests, 94% coverage
pnpm --filter @conflux-cas/worker test

# SDK unit tests — 87 tests
pnpm --filter @cfxdevkit/sdk test

# Backend integration tests — 16 tests
pnpm --filter @conflux-cas/backend test
```

---

## Acceptance Criteria Mapping

| Criterion | Status | Implementation |
|---|---|---|
| Strategies require explicit user approvals; no arbitrary custody | ✅ | `safeTransferFrom(owner, ...)` at execution only; keeper has no direct token authority |
| Limit orders execute only when price crosses target ± slippage | ✅ | Off-chain: `PriceChecker` + `SafetyGuard`; on-chain: `PriceConditionNotMet` revert |
| DCA jobs run on schedule with retry logic | ✅ | `JobPoller` interval + `RetryQueue` back-off; 15 s buffer prevents boundary reverts |
| Global pause + per-job cancel persist across restarts | ✅ | On-chain `Pausable` + DB `settings.paused`; worker reads both every tick |
| Dashboard reflects job state and execution history | ✅ | SSE-driven `JobTable`; `/job/[id]` execution history with ConfluxScan tx links |

---

## Key Environment Variables

```dotenv
EXECUTOR_PRIVATE_KEY=0x...         # keeper wallet — executor role only
AUTOMATION_MANAGER_ADDRESS=0x...   # deployed AutomationManager
MAX_GAS_PRICE_GWEI=1000            # gas circuit-breaker
WORKER_RPC_TIMEOUT_MS=120000       # abort stuck RPC calls after N ms
WORKER_POLL_INTERVAL_MS=15000      # keeper poll cadence
DRY_RUN=false                      # true = evaluate without submitting txs
```
