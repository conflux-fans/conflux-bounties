# Conflux Contract Metadata Registry

> A place for Conflux projects to publish verified metadata — ABI, source info, logos, and descriptions — for their deployed contracts. Everything lives on IPFS, and there's a web UI for submitting, updating, and browsing entries.

Explorers and wallets shouldn't have to guess what a contract does. This registry gives them a canonical source of truth: an on-chain record pointing to a pinned IPFS payload, verified by the contract owner and approved by a moderator.

## How it works

1. A developer connects their wallet, fills in the submission form (contract address, ABI, description, logo, tags), and signs with EIP-712.
2. The backend validates the metadata against a Zod schema, pins it to IPFS via Pinata, computes a keccak256 checksum, and queues a verification job (bytecode match + ownership check).
3. The on-chain registry stores the CID, checksum, and version. A moderator reviews the entry and approves or rejects it.
4. Once approved, any wallet or explorer can fetch the metadata through the public API (with caching headers) or read the registry contract directly.
5. When metadata changes, the developer submits a new version — the history is kept in the database and shown in the UI.

## Project layout

| Directory | What's inside |
|-----------|---------------|
| `contracts/` | Solidity registry contract (UUPS upgradeable, OpenZeppelin AccessControl), tests, deploy scripts, gas report |
| `backend/` | Fastify API — schema validation, IPFS pinning, ConfluxScan checks, BullMQ verification queue, Prisma + Postgres |
| `frontend/` | Next.js + Tailwind + wagmi — submission form, explore page, contract detail view, admin dashboard |
| `shared/` | Shared Zod metadata schema and types used by both backend and frontend |
| `sdk/` | Lightweight client for wallets/explorers to fetch metadata (with ETag caching) |
| `docker/` | Docker Compose for the full local stack (Postgres, Redis, backend, frontend) |
| `docs/` | API reference, metadata schema docs, re-pinning runbook, security notes, testing guide |

---

## Getting started

### Prerequisites

- **Node.js 18+** and npm
- **Docker** (for Postgres and Redis — or install them locally)
- A **Conflux wallet** with some testnet CFX ([get some here](https://faucet.confluxnetwork.org/))
- A **Pinata** account for IPFS pinning

### 1. Install everything

From the repo root (npm workspaces will handle all packages):

```bash
npm install
```

### 2. Set up environment files

Copy the example `.env` files and fill in your values:

- `contracts/.env` — your deployer private key and RPC URL
- `backend/.env` — database, Redis, Pinata, registry address
- `frontend/.env` — public API URL, registry address, RPC

Each directory has a `.env.example` you can use as a starting point.

---

## Smart contracts

### Compile

```bash
cd contracts
npx hardhat compile
```

### Run tests

```bash
cd contracts
npm test
```

This also prints a gas report (enabled in `hardhat.config.ts`).

### Deploy to Conflux testnet

Make sure `contracts/.env` has your `PRIVATE_KEY` (hex, no `0x` prefix) and optionally `CONFLUX_RPC_URL`.

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network confluxTestnet
```

You'll see the proxy address in the output — save it, you'll need it for the backend and frontend config.

### Local development (optional)

If you'd rather test against a local Hardhat node:

```bash
cd contracts
npx hardhat node
# In another terminal:
npx hardhat run scripts/deploy.ts --network localhost
```

### Upgrading

The contract uses UUPS. To upgrade, deploy a new implementation and call `upgradeToAndCall` from an account with `UPGRADER_ROLE`. See the OpenZeppelin UUPS docs and the contract's `_authorizeUpgrade` for details.

---

## Backend

The backend needs **Postgres** and **Redis**. The easiest way to get them running is Docker.

### Start the infrastructure

```bash
cd docker
docker compose up -d postgres redis
```

This gives you Postgres on `localhost:5432` and Redis on `localhost:6379`.

### Set up the database

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

When Prisma asks for a migration name, something like `init` works fine.

### Start the API server

```bash
cd backend
npm run dev
```

The API runs on **http://localhost:3000** by default.

### Key endpoints

| Method | Path | What it does |
|--------|------|-------------|
| `GET` | `/v1/metadata/` | List approved metadata (supports `?tag=` and `?q=` filters) |
| `GET` | `/v1/metadata/:address` | Registry record (CID, checksum, version) with cache headers |
| `GET` | `/v1/metadata/:address/full` | Full metadata JSON from IPFS, with caching |
| `POST` | `/v1/submissions/prepare` | Validate metadata, pin to IPFS, return CID + checksum |
| `POST` | `/v1/submissions/finalize` | Create submission record, enqueue verification |
| `GET` | `/v1/submissions/` | List submissions (for admin dashboard) |
| `POST` | `/v1/assets/logo` | Upload a logo image (multipart, MIME restricted) |

See [docs/api-reference.md](docs/api-reference.md) for the full reference.

### Run backend tests

```bash
cd backend
npm run test:run          # single run
npm run test:coverage     # with coverage report
```

---

## Frontend

The web UI is a Next.js app with Tailwind CSS and wagmi for wallet interactions.

```bash
cd frontend
npm run dev
```

Then open **http://localhost:3001** (or whatever port Next.js assigns).

The frontend includes:

- **Submit page** — fill in contract details, sign with your wallet, submit to the registry
- **Explore page** — search and filter approved contracts by name, description, or tag
- **Contract detail page** — view metadata, ABI, download links, version history, owner actions (transfer ownership, set resolver, manage delegates)
- **Admin dashboard** — review and approve/reject pending submissions (requires `MODERATOR_ROLE`)

The contract detail page uses **server-side rendering** for the initial metadata fetch, so it loads fast even before JavaScript hydrates.

---

## Environment variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `CONFLUX_RPC_URL` | contracts, backend, frontend | Conflux RPC endpoint (defaults to eSpace testnet) |
| `REGISTRY_ADDRESS` | backend, frontend | Deployed registry proxy address |
| `PINATA_JWT` | backend | Pinata API token for IPFS pinning |
| `DATABASE_URL` | backend | Postgres connection string |
| `REDIS_URL` | backend | Redis URL for BullMQ and rate limiting |
| `MODERATOR_WALLET` | backend | Address allowed to approve/reject via the API |
| `WEBHOOK_URL` | backend | URL to notify when metadata is approved |
| `MAX_METADATA_KB` | backend | Max metadata JSON size (default: 50) |
| `ALLOWED_LOGO_MIME` | backend | Comma-separated allowed MIME types for logos |
| `PRIVATE_KEY` | contracts | Deployer private key (hex, no `0x`) |
| `NEXT_PUBLIC_*` | frontend | API URL, registry address, RPC (see `frontend/.env.example`) |

---

## Running with Docker

To spin up the entire stack (Postgres, Redis, backend, frontend) in one command:

1. Set your environment values in `docker/.env` (or export them).
2. From the repo root:

```bash
docker compose -f docker/docker-compose.yml up -d
```

The backend will be at **http://localhost:3000** and the frontend at **http://localhost:3001**. The first build takes a few minutes.

---

## Running tests

Run all workspace tests from the root:

```bash
npm run test
```

Or run them individually:

```bash
cd contracts && npm test             # Hardhat (Solidity)
cd backend  && npm run test:run      # Vitest
cd frontend && npm run test -- --run # Vitest
cd sdk      && npm test              # Vitest
```

For coverage reports: `cd backend && npm run test:coverage` or `cd frontend && npm run test -- --run --coverage`.

Full testing details: [docs/testing.md](docs/testing.md).

---

## Architecture at a glance

- **Registry contract** — UUPS upgradeable, stores metadata CIDs + checksums + versions on-chain. Ownership verified via `owner()` call or EIP-712 signature. Delegates can submit on behalf of owners. `approve` and `reject` are moderator-only.
- **Backend** — Fastify API that validates metadata (Zod, <50KB), pins to IPFS (Pinata), checks bytecode hash against on-chain code, verifies via ConfluxScan, manages a BullMQ verification queue, rate-limits per IP and per wallet, writes an audit log, and fires webhooks on approval.
- **Frontend** — Next.js + Tailwind + wagmi. SSR for the contract detail page. EIP-712 signing for submissions. Admin dashboard checks `MODERATOR_ROLE` on-chain before showing controls.
- **SDK** — `ConfluxMetadataClient` wraps the public API with ETag-based caching. See `sdk/README.md`.

---

## Documentation

- [API Reference](docs/api-reference.md) — every endpoint, request/response format, error codes
- [Metadata Schema](docs/metadata-schema.md) — field definitions, validation rules, examples
- [Integration Kit](docs/integration-kit.md) — SDK usage, REST examples, caching strategy
- [IPFS Re-pin Runbook](docs/runbook-repin.md) — CLI for re-pinning and verifying CIDs
- [Security, RBAC & Audit](docs/security-rbac-audit.md) — roles, permissions, rate limiting, audit logs
- [Testing Guide](docs/testing.md) — how to run unit, integration, and e2e tests
