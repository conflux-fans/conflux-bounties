# Gated site — Conflux Bounty #06

A **Next.js** demo: connect a wallet on **Conflux eSpace**, **sign in with SIWE**, then open pages and files only if **on-chain rules** (tokens / NFTs) or **allowlists** allow it. Admins manage rules, uploads, and logs.

Full requirements: [`spec.md`](./spec.md).

---

## Quick start

1. **Copy env** — `cp .env.example .env`
2. **Database** — Set `DATABASE_URL`. With Docker: `npm run db:up`, wait a few seconds, then:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
3. **Required env** — `SESSION_SECRET` (32+ characters), `SIWC_DOMAIN` / `NEXT_PUBLIC_SIWC_DOMAIN` (e.g. `localhost`), `ADMIN_WALLETS` (your wallet to use `/admin`).
4. **Run** — `npm install` → `npm run dev` → open [http://localhost:3000](http://localhost:3000).

Sign in: **Login** → connect wallet (chain **1030** or **71**) → sign the message.  
Default seed rules are strict; use **Admin** to allowlist your address or attach real token contracts.

---

## What you can open

| Where | What |
|--------|------|
| `/` | Home |
| `/login` | Wallet + SIWE sign-in |
| `/profile` | Session info, sign out |
| `/members`, `/resources/*` | Need a session **and** passing gate rules |
| `/admin` | Rules, files, metadata, lists, logs — **only** wallets in `ADMIN_WALLETS` |
| `GET /api/protected/ping` | Example API with the same gating |

**Note:** Connecting a wallet in the header is **not** the same as signing in. You must complete SIWE on `/login`.

---

## File downloads (local vs R2)

1. User passes gating → app issues a short-lived **signed link** (`POST /api/assets/issue`).
2. **`GET /api/assets/download`** checks that link, logs access, then:
   - **`STORAGE_MODE=local` (default)** — file is read from `storage/gated/` on the server.
   - **`STORAGE_MODE=r2` or `s3`** — browser gets a **302** to a **short-lived presigned URL** (e.g. Cloudflare R2). Set `R2_*` in `.env` (see `.env.example`; `S3_*` names work as fallbacks).

In production, set **`NEXT_PUBLIC_APP_URL`** so issued download URLs use the right host.

---

## Metadata refresh (cron)

Refreshes token metadata cache (same logic as the admin refresh).

1. Set **`CRON_SECRET`** in `.env`.
2. Call **`GET` or `POST /api/cron/metadata-refresh`** with `Authorization: Bearer <CRON_SECRET>` (or `?secret=` for quick tests).
3. Schedule with **`npm run metadata:cron`**, your host’s cron, CI, or Docker Compose **`--profile cron`**.

---

## Tests

```bash
npm test              # unit tests
npm run test:coverage # + coverage (see jest.config.mjs)
npm run test:e2e      # Playwright (home, login, unauthenticated API)
```

---

## Useful scripts

```bash
npm run dev           # dev server
npm run build         # production build
npm run db:up         # Postgres via Docker helper
npm run db:seed       # seed data
npm run metadata:cron # one-shot cron call (needs app URL + CRON_SECRET)
```

**Postman:** [`postman/conflux-gated-site.postman_collection.json`](./postman/conflux-gated-site.postman_collection.json)

---

## Stack (short)

Next.js 15, React 19, Tailwind, wagmi/viem, Prisma + PostgreSQL, session cookie via **jose**. Optional **Redis** for rate limits (`REDIS_URL`).

---

## Gating example (`rulesJson`)

```json
{
  "conditions": [
    {
      "type": "ERC20",
      "chainId": 1030,
      "address": "0xYourTokenAddress",
      "minBalance": "1000000000000000000"
    }
  ]
}
```

Rules can use **`ALL`** or **`ANY`**. Path patterns can end with `*` (e.g. `/resources/*`). More examples in **`spec.md`**.

---

## Troubleshooting

| Problem | Try |
|---------|-----|
| Database errors (`P1001`, etc.) | Start Postgres; check `DATABASE_URL`; `npm run db:up` if you use Docker. |
| Docker errors | Start Docker Desktop (or daemon), then retry. |
| SIWE / login fails | `SIWC_DOMAIN` and `NEXT_PUBLIC_SIWC_DOMAIN` must match the site you open in the browser. |
| `/admin` forbidden | Add your wallet to **`ADMIN_WALLETS`** in `.env`. |

Rate limits, hCaptcha, and webhooks: **`.env.example`** and [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md).

---

## License

MIT (or match parent monorepo).
