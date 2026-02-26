# Testing

test suite covers contracts, API validation, and e2e submission flow with a target of **>80% coverage**.

---

## Unit tests

### Contracts (Hardhat)

- **Location:** `contracts/test/`
- **Run:** `cd contracts && npm test`
- **With gas report:** `cd contracts && npx hardhat test` (gas reporter enabled in `hardhat.config.ts`)
- **Coverage:** `cd contracts && npm run coverage`

Covers: registry logic, `submitMetadata`, `approve`, `reject`, `transferOwnership`, `setResolver`, ownership and EIP-712 delegation, access control.

### Backend (Vitest)

- **Location:** `backend/src/**/*.test.ts`
- **Run:** `cd backend && npm run test:run`
- **Watch:** `cd backend && npm test`
- **Coverage:** `cd backend && npm run test:coverage`

Covers: routes (submission prepare/finalize, public metadata, assets), services (IPFS, verification, ConfluxScan, webhook), validation and rate limiting.

### SDK (Vitest)

- **Location:** `sdk/src/*.test.ts`
- **Run:** `cd sdk && npm test`

Covers: client `getMetadata`, `getMetadataFull` (including caching/ETag behavior).

### Frontend (Vitest)

- **Location:** `frontend/src/**/*.test.ts` (excludes `e2e/` – Playwright)
- **Run:** `cd frontend && npm test` (watch) or `npm run test -- --run` (CI)
- **Coverage:** `cd frontend && npm run test -- --run --coverage` (90%+ for lib and services)
- **Covers:** API client (`api.ts`), registry (`registry.ts`), server API (`server-api.ts`)

---

## Integration tests

- **Backend:** Submission flow tests use mocked Prisma/Redis/queue; for full integration, run the API with real Postgres and Redis and hit endpoints (see [README](../README.md) for run order).
- **E2E (Playwright):** `cd frontend && npm run test:e2e`. Mock API runs on port 3099; tests cover submission flow, contract page, explore, admin, accessibility, and navigation.
- **E2E submission flow:** Connect wallet → prepare metadata → finalize → (optional) admin approve; verify via `GET /v1/metadata/:address` and `GET /v1/metadata/:address/full`.

---

## Run all workspace tests

From repository root:

```bash
npm install
npm run test
```

This runs `test` in each workspace (contracts, backend, frontend, shared, sdk). For backend integration tests with real DB/Redis, start Postgres and Redis (e.g. `docker compose -f docker/docker-compose.yml up -d postgres redis`), then run `cd backend && npm run test:run` with `DATABASE_URL` and `REDIS_URL` set.

---

## CI/CD

GitHub Actions workflow (`.github/workflows/test.yml`) runs on push/PR to `main`/`master`:

- **Contracts:** compile + test (with optional gas report)
- **Backend:** Prisma migrate + Vitest with Postgres and Redis services
- **SDK:** build shared, run SDK tests
- **Frontend:** Vitest unit tests + build; **Frontend E2E:** Playwright (mock API on 3099)

See the workflow file for required env vars and service configuration.
