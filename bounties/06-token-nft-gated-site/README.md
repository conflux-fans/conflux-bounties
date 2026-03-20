# Gated — Token & NFT site (Conflux Bounty #06)

A **Next.js 15** demo app for **Conflux eSpace**: users **connect a wallet**, **sign a SIWE-style message** to get a **server session**, then access **members-only pages** only if **on-chain rules** (ERC20 / ERC721 / ERC1155) or **allowlists** say they can. Admins edit rules, upload gated files, and inspect access logs.

**Goal of this README:** anyone opening the repo should understand **what it does** and **what was customized** in this version.

---

## What I built (plain English)

| Piece | What it does |
|--------|----------------|
| **Wallet + SIWE** | Connect with wagmi → sign a typed message → cookie + Postgres session. **Connecting the wallet is not the same as being signed in** — the UI reflects both. |
| **Gating** | Routes like `/members` and `/resources/*` check your wallet against **rules** (token balances / NFTs) or **allow/deny lists** before rendering. |
| **Signed downloads** | After you pass checks, the app can issue a **short-lived link** to a file; the server verifies an **HMAC** and can log **SHA-256** for integrity. |
| **Admin console** | If your wallet is in `ADMIN_WALLETS`, you can manage rules, uploads, token metadata cache, lists, and see recent access events. |

Full bounty checklist lives in [`spec.md`](./spec.md).

---

## Changes & highlights (this fork)

- **UI overhaul** — Shared **design tokens** (`paper` / `ink` / `accent`), reusable classes in `src/app/globals.css` (`btn-primary`, `ui-card`, `input-field`, etc.), **`PageShell`** for consistent pages, **footer**, and a **sticky header** with clearer **wallet vs session** states (badges, “complete SIWE” hint when only connected).
- **Navigation** — Single **`AppHeader`**; removed duplicate **Profile** from the wallet block; admin uses the **same global header** (no second full nav bar — only a small in-page “Admin” strip).
- **Pages** — Home, login, members, profile, resources, unauthorized, admin clients, and loading states updated to the same visual language.
- **Docs / ops** — Prisma 6 config, DB helper scripts, tests and Postman collection (see below) kept aligned with the app.

---

## Quick start

1. **Database** — Postgres must be reachable (`DATABASE_URL`). Easiest:  
   `npm run db:up` → wait a few seconds → `npx prisma db push` → `npm run db:seed`  
   (Needs Docker; if not available, use local Postgres or a hosted URL — details were in older long-form docs; see `.env.example`.)

2. **Environment**
   ```bash
   cp .env.example .env
   ```
   Set at least: **`DATABASE_URL`**, **`SESSION_SECRET`** (32+ chars), **`SIWC_DOMAIN`** / **`NEXT_PUBLIC_SIWC_DOMAIN`** (e.g. `localhost` locally), **`ADMIN_WALLETS`** (your wallet for `/admin`).

3. **Run**
   ```bash
   npm install
   npx prisma db push
   npm run db:seed
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) → **Sign in** → connect on **1030** or **71** → sign the message.

4. **Access members area** — Default seed rules are strict. Either add your address to the **allowlist** in Admin, or change rules to real token contracts.

More options: **Docker Compose** full stack, SIWE step-by-step, signed-asset flow, and rule JSON examples are still valid — see sections below or [`spec.md`](./spec.md).

---

## Main routes

| Route | Purpose |
|--------|---------|
| `/` | Landing |
| `/login` | Connect wallet + SIWE |
| `/profile` | Session info, sign out |
| `/members`, `/resources/*` | Session required + **token gating** |
| `/admin` | Rules, assets, metadata, lists, logs (**admin wallets only**) |
| `GET /api/protected/ping` | Example gated API |

---

## Tech stack (short)

- **Next.js 15** (App Router), **React 19**, **Tailwind**
- **wagmi / viem** — wallet + RPC reads
- **Prisma + PostgreSQL** — sessions, rules, assets, logs
- **jose** — session JWT in httpOnly cookie
- Optional **Redis** for rate limits (`REDIS_URL`)

---

## SIWE flow (short)

1. `POST /api/auth/nonce` → nonce in DB  
2. User signs message (domain must match env)  
3. `POST /api/auth/login` → verify signature → session cookie  

Details: EIP-4361-shaped message in `src/lib/auth/siwe-message.ts`. Security notes: [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md).

---

## Signed downloads (short)

Files under `storage/gated/`. `POST /api/assets/issue` returns a time-limited URL; `GET /api/assets/download` checks the token and streams the file. Set **`NEXT_PUBLIC_APP_URL`** in production for correct links.

---

## Example `rulesJson` (gating)

```json
{
  "conditions": [
    {
      "type": "ERC20",
      "chainId": 1030,
      "address": "0xYourToken",
      "minBalance": "1000000000000000000"
    }
  ]
}
```

Use **`ALL`** or **`ANY`** in the rule row for combine logic. Paths support `*` suffix (e.g. `/resources/*`). More examples: [`spec.md`](./spec.md).

---

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| `P1001` / DB errors | Start Postgres; check `DATABASE_URL`. Try `npm run db:up` if you use Docker. |
| Docker / `docker.sock` | Start **Docker Desktop** (or daemon), then retry `npm run db:up`. |
| `unknown shorthand flag: 'd'` | Install **Compose V2** (Docker Desktop) or `docker-compose` CLI — the db script falls back when needed. |
| SIWE / login fails | `SIWC_DOMAIN` and `NEXT_PUBLIC_SIWC_DOMAIN` must match the host you use in the browser. |
| `/admin` blocked | Add your wallet (lowercase ok) to **`ADMIN_WALLETS`** in `.env`. |

---

## Optional hardening (env)

Rate limits (`REDIS_URL`, `RATE_LIMIT_*`), **hCaptcha** (`CAPTCHA_*`), and **`ABUSE_WEBHOOK_URL`** are documented in **`.env.example`**.

---

## Scripts & tooling

```bash
npm run dev          # dev server
npm run build        # production build
npm test             # Jest (unit)
npm run test:e2e     # Playwright
npm run db:up        # Postgres via Docker helper
```

- **Postman:** [`postman/conflux-gated-site.postman_collection.json`](./postman/conflux-gated-site.postman_collection.json)

---

## License

MIT (match parent monorepo if different).
