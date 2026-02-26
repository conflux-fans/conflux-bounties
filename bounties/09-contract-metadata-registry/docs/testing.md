# Testing Guide

The test suite covers smart contracts, the backend API, the frontend, and the SDK. The target is **>80% code coverage** for contracts and the API.

---

## Quick start

Run everything from the repo root:

```bash
npm install
npm run test
```

This runs tests across all workspaces (contracts, backend, frontend, shared, sdk).

---

## Smart contract tests (Hardhat + Chai)

**Where:** `contracts/test/`

```bash
cd contracts
npm test                    # run tests (includes gas report)
npm run coverage            # generate coverage report
```

**What's covered:**
- `submitMetadata` — direct owner submission, EIP-712 signature-based submission
- `approve` / `reject` — moderator-only access, duplicate approval prevention
- `transferOwnership` / `setResolver` — owner-only operations
- `addDelegate` / `removeDelegate` — delegation with expiry
- UUPS upgrade authorization
- Edge cases — zero address, expired signatures, replay attacks, contracts without `owner()`

---

## Backend tests (Vitest)

**Where:** `backend/src/**/*.test.ts`

```bash
cd backend
npm run test:run            # single run
npm test                    # watch mode
npm run test:coverage       # with coverage report
```

**What's covered:**
- **Routes:** submission prepare/finalize (validation, size limits, rate limiting, duplicate detection), public metadata endpoints (caching, ETag, search), asset uploads (MIME validation)
- **Services:** IPFS pinning, verification queue (bytecode match, ownership check, ConfluxScan), webhook delivery
- **Moderation:** approve/reject with moderator wallet enforcement, audit log entries

Tests use mocked Prisma, Redis, and BullMQ — no real database needed.

---

## Frontend tests (Vitest)

**Where:** `frontend/src/**/*.test.ts`

```bash
cd frontend
npm test                              # watch mode
npm run test -- --run                  # single run (for CI)
npm run test -- --run --coverage       # with coverage
```

**What's covered:** API client functions, registry helpers, server-side API wrappers.

---

## SDK tests (Vitest)

**Where:** `sdk/src/*.test.ts`

```bash
cd sdk
npm test
```

**What's covered:** `getMetadata`, `getMetadataFull` (including 404 handling, ETag-based caching, 304 responses).

---

## End-to-end tests (Playwright)

**Where:** `frontend/e2e/`

```bash
cd frontend
npm run test:e2e
```

The e2e tests spin up a mock API server on port 3099 and test the full user flows:
- Submission form interaction
- Contract detail page rendering
- Explore page search and filtering
- Admin dashboard approve/reject
- Navigation and accessibility checks

---

## Integration testing

The backend unit tests use mocks, which is great for speed but doesn't catch integration issues. For full integration testing:

1. Start Postgres and Redis (e.g. `cd docker && docker compose up -d postgres redis`)
2. Set `DATABASE_URL` and `REDIS_URL` in your environment
3. Run `cd backend && npx prisma migrate dev && npm run test:run`

This runs the same tests but against real infrastructure.

---

## CI/CD

The GitHub Actions workflow (`.github/workflows/test.yml`) runs on every push and PR to `main`:

| Job | What it does |
|-----|-------------|
| **Contracts** | Compile + run Hardhat tests (with gas report) |
| **Backend** | Prisma migrate + Vitest with Postgres and Redis services |
| **SDK** | Build shared package + run SDK tests |
| **Frontend** | Vitest unit tests + Next.js build |
| **Frontend E2E** | Playwright tests with mock API |

Check the workflow file for the required environment variables and service configuration.
