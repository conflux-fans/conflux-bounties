# Deploy Conflux Metadata Registry on Vercel

This guide walks through deploying the full stack (frontend + backend API) on Vercel.

## Architecture

You will create **two Vercel projects** from the same Git repository:

| Project | Root Directory | Description |
|---------|----------------|-------------|
| **conflux-metadata-api** | `backend` | Fastify API (Prisma, Redis, Pinata) |
| **conflux-metadata-app** | `frontend` | Next.js web UI |

Both use Vercel’s monorepo support by setting different Root Directories.

## Prerequisites

1. **Vercel account** – [vercel.com](https://vercel.com)
2. **Neon** (PostgreSQL) – [neon.tech](https://neon.tech) or Vercel Marketplace
3. **Upstash Redis** – [upstash.com](https://upstash.com) or Vercel Marketplace
4. **Pinata** – [pinata.cloud](https://pinata.cloud) for IPFS pinning

---

## Step 1: Create Database and Redis

### PostgreSQL (Neon)

1. Create a Neon project.
2. Copy the connection string (e.g. `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
3. Use this as `DATABASE_URL`.

### Redis (Upstash)

1. Create an Upstash Redis database (use the **Redis** product, not REST API).
2. Copy the Redis URL (starts with `rediss://`); the backend uses `ioredis`, which needs the Redis protocol URL.
3. Use this as `REDIS_URL`.

---

## Step 2: Deploy the API (Backend)

1. In Vercel: **Add New Project** → **Import Git Repository** → select your repo.

2. Configure:
   - **Project Name**: `conflux-metadata-api`
   - **Root Directory**: `backend`
   - **Framework Preset**: Other (Fastify is auto-detected)

3. **Environment Variables** (add all):

   | Variable | Value | Notes |
   |----------|-------|-------|
   | `DATABASE_URL` | `postgresql://...` | From Neon |
   | `REDIS_URL` | `rediss://...` or Upstash Redis URL | From Upstash |
   | `PINATA_JWT` | Your Pinata API key | Required for IPFS |
   | `CONFLUX_RPC_URL` | `https://evmtestnet.confluxrpc.com` | Or mainnet |
   | `REGISTRY_ADDRESS` | `0x...` | Deployed registry proxy |
   | `MODERATOR_WALLET` | `0x...` | Optional; enforces approve/reject caller |
   | `WEBHOOK_URL` | `https://...` | Optional; notify on approval |
   | `MAX_METADATA_KB` | `50` | Optional |
   | `ALLOWED_LOGO_MIME` | `image/png,image/jpeg,image/svg+xml` | Optional |

4. Deploy. The API will be available at `https://conflux-metadata-api-xxx.vercel.app`. Frontend must use `NEXT_PUBLIC_API_URL` with `/v1` suffix (e.g. `https://conflux-metadata-api-xxx.vercel.app/v1`).

5. Run migrations:

   ```bash
   cd backend
   DATABASE_URL="your-neon-url" npx prisma migrate deploy
   ```

---

## Step 3: Deploy the Frontend

1. In Vercel: **Add New Project** → **Import Git Repository** → select the same repo.

2. Configure:
   - **Project Name**: `conflux-metadata-app`
   - **Root Directory**: `frontend`
   - **Framework Preset**: Next.js (auto-detected)

3. **Environment Variables**:

   | Variable | Value | Notes |
   |----------|-------|-------|
   | `NEXT_PUBLIC_API_URL` | `https://conflux-metadata-api-xxx.vercel.app/v1` | API base URL including `/v1` |
   | `NEXT_PUBLIC_REGISTRY_ADDRESS` | `0x...` | Same as backend |
   | `NEXT_PUBLIC_CONFLUX_RPC_URL` | `https://evmtestnet.confluxrpc.com` | Or mainnet |
   | `NEXT_PUBLIC_IPFS_GATEWAY` | `https://gateway.pinata.cloud` | Optional; default Pinata |

4. Deploy. The app will be at `https://conflux-metadata-app-xxx.vercel.app`.

---

## Step 4: Custom Domains (Optional)

1. API: add your API domain (e.g. `api.yourdomain.com`) in the API project settings.
2. Frontend: add your main domain (e.g. `app.yourdomain.com` or `yourdomain.com`) in the frontend project.
3. Update `NEXT_PUBLIC_API_URL` in the frontend project to the new API domain.

---

## Environment Variables Summary

### Backend (API project)

```
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
PINATA_JWT=...
CONFLUX_RPC_URL=https://evmtestnet.confluxrpc.com
REGISTRY_ADDRESS=0x...
```

### Frontend (App project)

```
NEXT_PUBLIC_API_URL=https://your-api.vercel.app/v1
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_CONFLUX_RPC_URL=https://evmtestnet.confluxrpc.com
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud
```

---

## Monorepo Build

Both projects use a monorepo setup:

- **Install**: runs `cd .. && npm install` from the project root so workspace dependencies are installed.
- **Build**:
  - Backend: builds `shared`, runs Prisma generate, then compiles the backend.
  - Frontend: builds `shared`, then builds the Next.js app.

---

## Contracts

Contracts are not deployed on Vercel. Deploy them to Conflux (testnet or mainnet) with Hardhat, then set `REGISTRY_ADDRESS` in both Vercel projects.

---

## Troubleshooting

- **API 500**: Check Vercel function logs; confirm `DATABASE_URL`, `REDIS_URL`, and `PINATA_JWT` are set.
- **CORS**: The API allows all origins; if issues persist, verify the frontend domain.
- **Prisma migrations**: Run `npx prisma migrate deploy` locally with `DATABASE_URL` after creating the Neon database.
