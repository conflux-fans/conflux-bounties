# Conflux Contract Metadata Registry

**Type:** Smart Contracts, IPFS, Web UI ·

A verified metadata registry where Conflux projects upload ABI, source, logo, and descriptions for deployed contracts. Metadata lives on IPFS; a web UI lets teams submit, update, and browse entries with validation rules. Explorers and wallets can consume metadata via a public API and the on-chain registry.

## Project Structure

| Directory    | Description |
| ------------ | ----------- |
| `contracts/`  | Solidity registry (UUPS upgradeable, OpenZeppelin), tests, deploy scripts, gas report |
| `backend/`   | Node.js/Fastify API, schema validation (Zod), IPFS pinning, ConfluxScan, webhook, BullMQ/Redis, Prisma (Postgres) |
| `frontend/`  | Next.js + Tailwind + wagmi (wallet connect, Conflux eSpace testnet) |
| `shared/`    | Shared types & metadata schema (Zod) |
| `sdk/`       | Lightweight SDK for wallets/explorers to fetch metadata (with caching guidance) |
| `docker/`    | Docker Compose: Postgres, Redis, backend, frontend |
| `docs/`      | API reference, metadata schema, runbook for re-pinning |

---

## Environment & config

| Variable | Where | Description |
| -------- | ----- | ----------- |
| `CONFLUX_RPC_URL` | contracts, backend, frontend | Conflux RPC (e.g. evmtestnet) |
| `REGISTRY_ADDRESS` | backend, frontend | Deployed registry proxy address |
| `PINATA_JWT` | backend | IPFS pinning (Pinata) |
| `DATABASE_URL` | backend | Postgres connection string |
| `REDIS_URL` | backend | Redis for BullMQ and rate limiting |
| `MODERATOR_WALLET` | backend | Moderator address (audit / optional checks) |
| `WEBHOOK_URL` | backend | Notify watchers on approval |
| `MAX_METADATA_KB` | backend | Max metadata JSON size (default 50) |
| `ALLOWED_LOGO_MIME` | backend | Allowed logo MIME types |
| `CONFLUXSCAN_API_URL` / `CONFLUXSCAN_API_KEY` | backend | Optional ConfluxScan API for contract verification |
| `PRIVATE_KEY` | contracts | Deployer key (hex, no 0x) for deployment |
| `NEXT_PUBLIC_*` | frontend | API URL, registry address, RPC (see `frontend/.env.example`) |

Copy `backend/.env.example`, `contracts/.env.example`, and `frontend/.env.example` to `.env` and fill in values. Full variable list: [docs/env-and-config.md](docs/env-and-config.md).

---

## Prerequisites

- **Node.js** 18+ and **npm**
- **Docker** and **Docker Compose** (for Postgres and Redis, or full stack)
- **Conflux wallet** with testnet CFX for deploying contracts
- **Pinata** account (for IPFS; used by the backend)

---

## Step-by-step: Run contracts

### 1. Install dependencies

From the **repository root** (workspace installs all packages):

```bash
npm install
```

Or only for contracts:

```bash
cd contracts
npm install
```

### 2. Configure environment (contracts)

Create `contracts/.env` with:

```env
# Required for deployment. Use a wallet with testnet CFX.
PRIVATE_KEY=your_deployer_private_key_hex_without_0x

# Optional; defaults to Conflux EVM testnet
CONFLUX_RPC_URL=https://evmtestnet.confluxrpc.com
```

- Get testnet CFX from the [Conflux faucet](https://faucet.confluxnetwork.org/).
- Never commit `.env` or share your private key.

### 3. Compile contracts

```bash
cd contracts
npx hardhat compile
```

You should see `Compiled X Solidity files successfully` and artifacts under `contracts/artifacts/`.

### 4. Run contract tests (optional)

```bash
cd contracts
npm test
```

**Gas report:** The same command runs tests with the gas reporter enabled (see `hardhat.config.ts`). For a printed gas report, run `npx hardhat test` in `contracts/`.

### 5. Deploy to Conflux testnet

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network confluxTestnet
```

Example output:

```text
Deploying contracts with the account: 0x...
MetadataRegistry deployed to: 0x...
```

Save the **deployed proxy address**; the frontend and backend may need it (e.g. `NEXT_PUBLIC_REGISTRY_ADDRESS` or config).

### 6. Deploy to a local Hardhat network (optional)

```bash
cd contracts
npx hardhat node
```

In another terminal:

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network localhost
```

---

## Step-by-step: Run backend

The backend needs **PostgreSQL** and **Redis**. You can run them via Docker or install them locally.

### 1. Install dependencies

From the repo root (recommended):

```bash
npm install
```

Or only backend:

```bash
cd backend
npm install
```

### 2. Configure environment (backend)

Copy `backend/.env.example` to `backend/.env` and set:

- **Required:** `DATABASE_URL`, `REDIS_URL`, `PINATA_JWT`, `CONFLUX_RPC_URL`, `REGISTRY_ADDRESS`
- **Optional:** `MODERATOR_WALLET`, `WEBHOOK_URL`, `MAX_METADATA_KB` (default 50), `ALLOWED_LOGO_MIME`, `MAX_SUBMISSIONS_PER_WALLET_PER_MIN` (default 10), `CONFLUXSCAN_API_URL`, `CONFLUXSCAN_API_KEY`, `PORT`

If you use Docker Compose, `DATABASE_URL` and `REDIS_URL` must point at the `postgres` and `redis` services (see `docker/docker-compose.yml`).

### 3. Start Postgres and Redis (Docker)

From the **repository root**:

```bash
cd docker
docker compose up -d postgres redis
```

Or with legacy CLI:

```bash
docker-compose -f docker/docker-compose.yml up -d postgres redis
```

This starts:

- **PostgreSQL** on `localhost:5432` (user `metadata`, password `metadata`, database `metadata` with the first block in `docker-compose.yml`).
- **Redis** on `localhost:6379`.

To start only Postgres and Redis from the **second** block in your compose file (different credentials), use the same command but ensure the compose file you use defines those services; adjust `backend/.env` to match (e.g. `user`/`password`/`conflux_registry` if that block is the one in use).

### 4. Create and migrate the database

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

- `prisma generate` generates the Prisma client.
- `prisma migrate dev` creates the database if needed and applies migrations.

When prompted for a migration name, you can use e.g. `init`.

### 5. Run the backend

```bash
cd backend
npm run dev
```

The API listens on **http://localhost:3000** (or the `PORT` in `.env`).

Useful endpoints:

- `GET  /v1/metadata/` – list approved metadata (optional `?tag=` and `?q=`)
- `GET  /v1/metadata/:address` – registry record (CID, checksum, version) with cache headers
- `GET  /v1/metadata/:address/full` – full metadata JSON from IPFS (for wallets/explorers) with cache headers
- `POST /v1/submissions/prepare` – prepare submission (returns CID and checksum)
- `POST /v1/submissions/finalize` – finalize submission (rate limited per IP and per wallet)
- `GET  /v1/submissions/` – list submissions (e.g. for admin)
- `POST /v1/assets/logo` – upload logo (multipart; MIME restricted by `ALLOWED_LOGO_MIME`)

Full API: [docs/api-reference.md](docs/api-reference.md). Metadata schema: [docs/metadata-schema.md](docs/metadata-schema.md).

### 6. Run backend tests (optional)

```bash
cd backend
npm run test:run
```

With coverage:

```bash
npm run test:coverage
```

---

## Run order summary

| Step | Where        | Command / action |
| ---- | ------------ | ----------------- |
| 1    | Root         | `npm install` |
| 2    | Contracts    | Create `contracts/.env` (PRIVATE_KEY, CONFLUX_RPC_URL) |
| 3    | Contracts    | `npx hardhat compile` |
| 4    | Contracts    | `npx hardhat run scripts/deploy.ts --network confluxTestnet` (save proxy address) |
| 5    | Backend      | Create `backend/.env` (DATABASE_URL, REDIS_URL, PINATA_JWT) |
| 6    | Docker       | `cd docker && docker compose up -d postgres redis` |
| 7    | Backend      | `npx prisma generate && npx prisma migrate dev` |
| 8    | Backend      | `npm run dev` |

---

## Deploy on Vercel

To run the full stack on Vercel, see **[docs/vercel-deployment.md](docs/vercel-deployment.md)**. You will create two projects (API + frontend), connect Neon (Postgres) and Upstash (Redis), and configure environment variables.

---

## Run everything with Docker (optional)

To run Postgres, Redis, backend, and frontend via Docker:

1. Set in `backend/.env` (or compose env): `DATABASE_URL=postgresql://metadata:metadata@postgres:5432/metadata?schema=public`, `REDIS_URL=redis://redis:6379`, and a real `PINATA_JWT`.
2. From repo root:

   ```bash
   docker compose -f docker/docker-compose.yml up -d
   ```

Backend will be on **http://localhost:3000**, frontend on **http://localhost:3001**. Build may take a few minutes the first time.

---

## Architecture

- **Registry contract**: UUPS upgradeable; stores metadata CIDs, checksums, version, status. `submitMetadata`, `approve`, `reject`, `transferOwnership`, `setResolver`; ownership via `owner()` or EIP-712 delegate. **Upgrade path:** Deploy a new implementation and call `upgradeToAndCall` (or `upgradeTo`) from an account with `UPGRADER_ROLE`; see OpenZeppelin UUPS docs and the contract’s `_authorizeUpgrade`.
- **Backend**: Validates schema (Zod, &lt;50KB), pins to IPFS (Pinata), bytecode checksum verification, ConfluxScan, BullMQ verification queue, rate limit (per IP + per wallet), moderation log, webhook.
- **Frontend**: Next.js + Tailwind + wagmi; submit, sign, browse, admin approval view; contract page uses **SSR** (server-side fetch from API for initial metadata).
- **Integration kit**: Use `sdk/` or REST. For **caching**: call `GET /v1/metadata/:address/full`; respect `Cache-Control` (e.g. 5 min) and `ETag`; use `If-None-Match: <ETag>` for conditional requests to avoid re-downloading unchanged metadata. See [docs/api-reference.md](docs/api-reference.md).

---

## Docs & ops

- [API reference](docs/api-reference.md)
- [Metadata schema](docs/metadata-schema.md)
- [Integration kit](docs/integration-kit.md) – SDK, REST examples, caching for wallets/explorers
- [Runbook: IPFS re-pin and verify](docs/runbook-repin.md) – CLI `cd backend && npm run repin -- --cid <CID> | --address <0x...>`
- [Testing](docs/testing.md) – Unit and integration tests, coverage target >80%, CI
- [Security, RBAC & audit](docs/security-rbac-audit.md) – Roles, moderation log, rate limiting

---

## Verification

Run all workspace tests (contracts, backend, frontend, sdk; target **>80% coverage** for contracts and API):

```bash
npm run test
```

Run workspace tests:

```bash
cd contracts && npm test
cd backend  && npm run test:run
cd frontend && npm run test -- --run
cd sdk      && npm test
```

Coverage: `cd backend && npm run test:coverage`; `cd frontend && npm run test -- --run --coverage`. Full testing instructions: [docs/testing.md](docs/testing.md).
