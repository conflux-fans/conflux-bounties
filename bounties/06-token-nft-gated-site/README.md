# Gated site — Conflux Bounty #06

A **Next.js** demo: connect a wallet on **Conflux eSpace**, **sign in with SIWE**, then open pages and files only if **on-chain rules** (tokens / NFTs) or **allowlists** allow it. Admins manage rules, uploads, and logs.

Full requirements: [`spec.md`](./spec.md).

---

## Quick start (run locally)

### What you need

- **Node.js 20+** (LTS recommended) and **npm**
- **PostgreSQL** reachable from your machine — easiest is **Docker Desktop** (or another Docker engine) for `npm run db:up`
- A **wallet** (e.g. MetaMask) with **Conflux eSpace** mainnet (**1030**) or testnet (**71**) if you will sign in
- **Where gated files live:** by default the app stores them **on disk** under `./storage/gated` (`STORAGE_MODE=local`). To store uploads and serve downloads from **Cloudflare R2** (or any S3-compatible bucket), set **`STORAGE_MODE=r2`** (or `s3`) and the **`R2_*`** variables in `.env` — see the table below.

### 1. Open the project folder

If you cloned the **conflux-bounties** monorepo, this app lives here:

```bash
cd bounties/06-token-nft-gated-site
```

If you only have this repo, `cd` to its root (where `package.json` is).

### 2. Install dependencies

```bash
npm install
```

### 3. Create your `.env` file

```bash
cp .env.example .env
```

Edit **`.env`** and set at least:

| Variable | What to put |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string. The example points at `localhost:5432` with user/db `postgres` / `gated` — use that if you follow step 4 with Docker. |
| `SESSION_SECRET` | Any random string **at least 32 characters** (used to sign session cookies). |
| `SIWC_DOMAIN` | Usually `localhost` for local dev. |
| `NEXT_PUBLIC_SIWC_DOMAIN` | **Same value** as `SIWC_DOMAIN`. |
| `ADMIN_WALLETS` | Your wallet address (the one you will use in the browser), comma-separated if several. Replace the placeholder `0x0000…` in `.env.example`. |

**Gated file storage (local vs R2)** — important if you care where uploads and downloads go:

| Variable | What to put |
|----------|-------------|
| `STORAGE_MODE` | `local` (default in `.env.example`) — files on the server under `./storage/gated`. Use `r2` or `s3` when you configure a remote bucket below. |
| `R2_BUCKET` | Your R2 **bucket name** only (not a URL). |
| `R2_ENDPOINT` | Account S3 API URL: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` — **no** `/bucket` suffix. Create the bucket and S3-compatible API token in the Cloudflare R2 dashboard. |
| `R2_ACCESS_KEY_ID` | S3-compatible **access key** from the R2 API token. |
| `R2_SECRET_ACCESS_KEY` | S3-compatible **secret** from the R2 API token. |
| `R2_REGION` | Usually `auto` for R2. |
| `R2_FORCE_PATH_STYLE` | Typically `true` for R2 (path-style addressing). |

With **`STORAGE_MODE=r2`** and valid `R2_*` values, **admin uploads** and **`db:seed`** put objects in the bucket; after the app checks the signed download link, the browser is **redirected (302)** to a **short-lived presigned URL** instead of streaming from disk. If you omit remote config, keep **`STORAGE_MODE=local`**.

**S3-compatible providers:** you can use the legacy **`S3_*`** names instead of `R2_*` (see `.env.example`). Same flow: presigned GET after the HMAC gate.

### 4. Start Postgres and create tables

**Option A — Docker (recommended)**  

Start **Docker**, then:

```bash
npm run db:up
```

Wait until the container is healthy (often **5–15 seconds**), then:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

**Option B — your own Postgres**  

Create a database, set `DATABASE_URL` in `.env` to match it, then run the same three commands:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
```

`db:push` applies the schema; `db:seed` adds sample rules, assets, etc.

### 5. Start the app

```bash
npm run dev
```

In the terminal, note the URL (default **http://localhost:3000**). Open it in your browser.

### 6. Sign in and try the app

1. Go to **`/login`**.
2. **Connect** your wallet (network **1030** or **71**).
3. **Sign** the SIWE message when prompted — that creates a **server session** (different from only “connected” in the header).
4. Open **`/profile`** to confirm you are signed in.

**Gating:** Seed data is strict. To reach **`/members`** or gated resources, either add your address in **`/admin`** (allowlist / rules) or point rules at token contracts you actually hold.

**Admin:** `/admin` only works if your connected wallet is listed in **`ADMIN_WALLETS`** in `.env` (restart `npm run dev` after changing `.env`).

### If something fails

- **Database / `P1001`:** Postgres not running or wrong `DATABASE_URL`. Check Docker, or `npm run db:up` logs.
- **SIWE / login:** `SIWC_DOMAIN` and `NEXT_PUBLIC_SIWC_DOMAIN` must match how the app builds the sign-in message (see **Troubleshooting** below).

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
