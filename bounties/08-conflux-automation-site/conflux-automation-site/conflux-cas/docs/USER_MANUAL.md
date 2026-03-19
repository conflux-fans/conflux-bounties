# Conflux Automation Site — User Manual

> **Live app:** https://cas.cfxdevkit.org  
> **Local dev:** http://localhost:3000  
> **Prerequisites:** MetaMask (or compatible EIP-1193 wallet) + some CFX

---

## Network Setup

### Conflux eSpace Mainnet (production — chain ID 1030)

| Field | Value |
|-------|-------|
| Network name | Conflux eSpace |
| RPC URL | https://evm.confluxrpc.com |
| Chain ID | 1030 |
| Currency symbol | CFX |
| Block explorer | https://evm.confluxscan.org |

### Conflux eSpace Testnet (chain ID 71)

| Field | Value |
|-------|-------|
| Network name | Conflux eSpace Testnet |
| RPC URL | https://evmtestnet.confluxrpc.com |
| Chain ID | 71 |
| Currency symbol | CFX |
| Block explorer | https://evmtestnet.confluxscan.io |

Get free testnet CFX at https://faucet.confluxnetwork.org/

---

## User Stories

---

### Story 1 — Connect Wallet and Sign In

**As a user, I want to connect my wallet so the app knows who I am.**

1. Open https://cas.cfxdevkit.org — you see the **home page** with the tagline and strategy creation form.
2. In the top-right corner of the nav bar, click **Connect Wallet**.
3. Select MetaMask in the wallet modal and approve the connection.
4. The button changes to show your truncated address (e.g. `0xd8dA…6045`).
5. The app will automatically prompt you to **Sign In with Ethereum**. Click **Sign** in MetaMask. No gas is spent; this is an off-chain signature.
6. The app stores a JWT in your browser. You are now authenticated for 24 hours.

> **What happens behind the scenes:** The app requests a one-time challenge from the backend, you sign it with your wallet, and the backend issues a JWT. No password, no custody.

---

### Story 2 — Create a Limit Order

**As a user, I want to buy Token B when Token A reaches my target price.**

1. On the home page the strategy builder is immediately visible once you're signed in.
2. The form defaults to **Limit Order** mode.
3. Fill in the fields:

   | Field | What to enter | Example |
   |-------|--------------|---------|
   | **Token In** | Token you are selling (select from dropdown) | CFX |
   | **Token Out** | Token you are buying (select from dropdown) | USDT |
   | **Amount In** | Human-readable amount to sell | `100` |
   | **Target Price** | Desired rate (Token Out per Token In) | `1.05` |
   | **Direction** | When to fire | `Execute when price ≥ target` |
   | **Expires in** | Days until the order expires (optional) | `7` |
   | **Max Slippage** | Preset or custom percentage | `0.5%` |

4. Click **Submit Order**.

   A 4-step transaction stepper opens:
   - **Step 1** — Wrap CFX → wCFX (if Token In is native CFX and wCFX balance is insufficient)
   - **Step 2** — Approve the AutomationManager to spend your Token In (ERC-20 `approve`)
   - **Step 3** — Register the job on-chain via `AutomationManager.createLimitOrder()`
   - **Step 4** — Save the job to the backend database

   Confirm each wallet prompt in sequence. The modal cannot be closed mid-flow.

5. On success, the Dashboard table below the form shows your new job.

---

### Story 3 — Create a DCA Strategy

**As a user, I want to buy Token B in small recurring amounts over time.**

1. On the home page, click the **DCA** tab at the top of the strategy builder.
2. Fill in the fields:

   | Field | What to enter | Example |
   |-------|--------------|---------|
   | **Token In** | Token you are spending | CFX |
   | **Token Out** | Token you are accumulating | USDT |
   | **Amount Per Swap** | How much to spend each interval | `10` |
   | **Every** | Interval unit (minutes / hours / days) | `24 hours` |
   | **Over** | Total duration (days / weeks / months) | `10 days` |
   | **Max Slippage** | Preset or custom percentage | `1%` |

3. Click **Submit DCA**.
4. The Dashboard below updates immediately with the new strategy.

> A DCA of `10` CFX every `24` hours over `10` days will execute 10 swaps total.

---

### Story 4 — Monitor Strategies on the Dashboard

**As a user, I want to see all my active and historical strategies.**

The Dashboard is displayed on the home page below the strategy builder once you're authenticated.

Each job row shows:

| Column | Meaning |
|--------|---------|
| **Status badge** | See table below |
| **Type** | `limit_order` or `dca` |
| **Pair** | Token In → Token Out with icons |
| **Amount** | Amount per execution |
| **Progress / Next** | DCA: swaps completed / total + next tick time |
| **Retries** | Failed attempt count |
| **Created** | Timestamp |
| **Actions** | Details · Cancel |

**Job status lifecycle:**

| Status | Colour | Meaning |
|--------|--------|---------|
| `pending` | Yellow | Waiting to be picked up by the keeper |
| `active` | Green | Being processed / price condition check pending |
| `executed` | Blue | Successfully executed on-chain |
| `cancelled` | Grey | Cancelled by you or expired |
| `failed` | Red | Execution failed after max retries |

The dashboard updates in real-time via **Server-Sent Events** — no page refresh needed. Click **Details** on any row to see the full execution history with ConfluxScan links.

---

### Story 5 — Cancel a Strategy

**As a user, I want to cancel a pending strategy before it executes.**

1. Find the job in the Dashboard table.
2. The job must have status `pending` or `active`.
3. Click the **Cancel** button in the Actions column.
4. The row status immediately updates to `cancelled` via the live event stream.

> Once a job is `executed` or already `cancelled`, it cannot be undone.

---

### Story 6 — Use the Safety Panel (Admin)

**As an admin, I want to pause all keeper activity instantly.**

1. Click **Safety** in the nav bar.
2. You must be signed in. If not, the toggle has no effect.
3. The panel shows the **Global Pause** toggle:
   - **OFF** (default) — the keeper worker is running normally.
   - **ON** — all keeper execution is halted; no new on-chain transactions will be submitted.
4. Toggle to `ON` to halt the keeper. Toggle back to `OFF` to resume.

> The pause state persists in the database and survives backend restarts.

---

## Wallet Management & Custody Model

### Your keys stay yours

CAS is **fully non-custodial**. The app and the keeper never hold, import, or store your private key. The wallet is only used on your device for:

| Action | When | Gas cost |
|--------|------|----------|
| **Sign In with Ethereum (SIWE)** | Once per session | None — off-chain signature |
| **Wrap CFX → wCFX** | Only when CFX is Token In and wCFX balance is insufficient | Yes — on-chain tx |
| **ERC-20 `approve()` call** | Once per token, before first execution | Yes — on-chain tx |
| **Register job on-chain** | Once per strategy | Yes — on-chain tx |

Everything else — monitoring prices, building swap calldata, submitting the execution transaction — is done by the **keeper wallet** (`EXECUTOR_PRIVATE_KEY`), a separate server-side wallet that can only call `executeLimitOrder` / `executeDCATick` on the contract. It cannot move your tokens arbitrarily.

---

### What the app stores in your browser

| Item | Storage | Expires |
|------|---------|---------|
| JWT (session token) | `localStorage` key `cas_jwt` | 24 hours |
| Token pool cache | `localStorage` key `cas_pool_meta_v2` | 10 minutes TTL |
| Wallet connection state | wagmi / MetaMask internal | Until you disconnect |

---

### Required user interactions after a strategy is created

Once a strategy is submitted, the keeper handles execution automatically. Two situations still require your action:

#### 1 — Re-signing after session expiry

The JWT expires after **24 hours**. Simply click your wallet address in the nav to get a fresh signature. Your existing strategies are unaffected — the keeper continues executing them regardless.

#### 2 — Cancellation (optional, user-triggered)

Strategies remain `pending` until they execute, expire, or you cancel them manually. There is no automatic expiry unless you set an expiry date during creation.

---

## How Prices Are Monitored

Price monitoring is handled entirely by the **keeper worker** — a background server process.

### The poll loop

The worker ticks on a fixed interval (default **15 seconds**):

```
every 15 s:
  1. Load all pending/active jobs from the database
  2. For each job → check price condition (or DCA timer)
  3. If condition met → run SafetyGuard checks
  4. If guard passes → submit on-chain tx via the keeper wallet
  5. Update job status in the database → SSE event pushed to browser
```

### Price source

Prices are read **on-chain** from the **Swappi DEX** (Conflux eSpace's primary AMM). The `PriceChecker` calls the `SwappiPriceAdapter` contract — a free, gas-less read that queries current pool reserves for a spot price scaled to `1e18`.

### Condition evaluation

| Strategy type | Trigger condition |
|---------------|-------------------|
| **Limit Order (≥ target)** | `currentPrice ≥ targetPrice` |
| **Limit Order (≤ target)** | `currentPrice ≤ targetPrice` |
| **DCA** | `Date.now() ≥ nextExecution` |

### SafetyGuard circuit breakers

| Check | Default | What it prevents |
|-------|---------|-----------------|
| **Global Pause** | — | All execution (Safety page toggle) |
| **Max swap USD** | $10,000/swap | Accidentally large trades |
| **Max retries** | 5 attempts | Stuck jobs consuming gas indefinitely |
| **Max gas price** | 1,000 Gwei | Executing during network congestion |
| **Job expiry** | Set per strategy | Stale orders firing long after creation |
| **DCA interval** | Set per strategy | DCA ticking faster than configured |

### What happens on execution

1. Keeper calls `executeLimitOrder()` / `executeDCATick()` on `AutomationManager`.
2. Contract verifies caller is authorised and slippage guard (`minAmountOut`) is satisfied.
3. Contract pulls Token In from your wallet using your pre-approved allowance.
4. Token Out is sent directly to your wallet address.
5. Keeper marks the job completed in the database and broadcasts an SSE event.

### Retry behaviour

If execution fails (e.g. gas spike, RPC timeout):

- The job enters an **in-memory retry queue** with exponential back-off.
- Retried on subsequent ticks up to `maxRetries` (default: 5).
- After 5 failures the job is marked `failed` and no further attempts are made.
- An amber warning banner appears on the job row showing "⚠ Blocked — max retries reached".

---

## Navigation Reference

| Nav Link | URL | Requires wallet |
|----------|-----|-----------------|
| Home / Strategy Builder + Dashboard | `/` | Sign-in for builder + dashboard |
| Job Detail | `/job/[id]` | Yes (signed in) |
| Safety | `/safety` | Yes (signed in, admin) |
| Status | `/status` | No |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Connect your wallet" shown | Click **Connect Wallet** in the nav bar |
| Auto sign-in doesn't fire | Click your address → **Sign In** manually |
| Dashboard shows no jobs | Make sure you're signed in; try refreshing |
| Live updates stop | SSE reconnects automatically every 5 s; a 30 s fallback poll also runs |
| Job stays `pending` forever | Check `/status` — if worker heartbeat is stale the keeper may be down |
| Trade fails with `failed` status | Check token allowance — you must `approve()` the AutomationManager before execution |
| Safety toggle has no effect | You must be signed in with a valid JWT |
| "Wrapping CFX → wCFX" step appears during create | Expected — the app wraps the shortfall automatically when native CFX is Token In |

---

## Operator: Build & Deploy (Docker Compose)

Operators and maintainers can follow the full build & deploy guide in the repository root: [DEPLOY.md](../../DEPLOY.md).

Quick summary:

- Build multi-arch images with `docker buildx build --platform linux/amd64,linux/arm64 --file <service>/Dockerfile --tag ghcr.io/<org>/name:tag --push <service-dir>`.
- On the host, copy `.env.example` to `.env`, populate `JWT_SECRET`, `EXECUTOR_PRIVATE_KEY`, and `AUTOMATION_MANAGER_ADDRESS`, then `docker compose pull && docker compose up -d --force-recreate`.
- Use `docker compose logs -f worker` to inspect worker runtime output (price checks, execution logs).

Recent dev fixes to be aware of:

- `AuthProvider` now preserves the JWT on initial mount to avoid forced re-signs on page refresh.
- The worker now validates that a Swappi pair exists before calling `getAmountsOut` and normalizes prices to a 1e18 scale using token decimals (fixes comparisons against `targetPrice`).
- Executor now logs `currentPrice` and `targetPrice` at execution time for better debugging.
