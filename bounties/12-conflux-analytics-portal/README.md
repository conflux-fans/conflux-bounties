# Conflux Analytics Portal

On-chain analytics portal for Conflux eSpace (chain ID 1030). Ingests blocks, transactions, and ERC-20 transfers from the Conflux eSpace RPC, computes aggregates, and serves them via a REST API and React dashboard.

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Frontend   │◄──►│   API        │◄──►│  PostgreSQL  │
│  React+Vite  │    │  Fastify     │    │  TimescaleDB │
│  :5173       │    │  :3001       │    │  :5432       │
└──────────────┘    └──────────────┘    └──────────────┘
                          ▲
                          │
                    ┌─────┴──────┐    ┌──────────────┐
                    │  Ingestor  │◄──►│    Redis      │
                    │  BullMQ    │    │    :6379      │
                    └────────────┘    └──────────────┘
                          ▲
                          │
                    ┌─────┴──────┐
                    │ Conflux    │
                    │ eSpace RPC │
                    └────────────┘
```

## Quick Start

```bash
# Clone and navigate
cd bounties/12-conflux-analytics-portal

# Start everything (PostgreSQL, Redis, API, Ingestor, Frontend)
docker compose up --build

# Frontend:  http://localhost:5173
# API:       http://localhost:3001/api/v1/health
# API Docs:  http://localhost:3001/docs
```

## Local Development

```bash
# Install dependencies
pnpm install

# Start PostgreSQL and Redis (via Docker)
docker compose up postgres redis -d

# Run migrations and seed
pnpm migrate
pnpm seed

# Start services (in separate terminals)
pnpm dev:api
pnpm dev:ingestor
pnpm dev:frontend
```

## Project Structure

```
packages/
  shared/       Zod schemas, constants, utilities
  ingestor/     Block ingestion, BullMQ workers, aggregator
  api/          Fastify REST API with Zod validation
  frontend/     React + Vite + Tailwind + Recharts dashboard
db/
  migrations/   001-005 numbered SQL migrations
  seed/         Seed data generator and DApp tags
scripts/        migrate, seed, backfill, generate-api-key
docs/           Architecture, data dictionary, API reference
```

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20, TypeScript, pnpm workspaces |
| Chain | viem (Conflux eSpace, chain ID 1030) |
| Database | PostgreSQL 16 + TimescaleDB |
| Queue | BullMQ on Redis 7 |
| Validation | Zod |
| API | Fastify 4 + @fastify/swagger |
| Frontend | React 19 + Vite + Tailwind CSS 4 + Recharts + TanStack Query v5 + Zustand |
| Deployment | Docker Compose |

## API Endpoints

All endpoints live under `/api/v1/`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Sync status |
| GET | /activity/daily | Daily tx counts, active accounts |
| GET | /fees/daily | Gas prices, burned, tips |
| GET | /contracts/top | Top contracts (sortable) |
| GET | /contracts/:addr/stats | Per-contract daily stats |
| GET | /tokens | Token list with holders |
| GET | /tokens/:addr/holders | Top holders |
| GET | /tokens/:addr/stats | Token transfer stats |
| GET | /dapps/leaderboard | DApp rankings |
| GET | /network/overview | Latest block, TPS |
| GET | /transactions/stats | Success/failure rates |
| GET | /export/:widget | CSV/JSON export |
| POST | /shares | Create share link |
| GET | /shares/:slug | Load share link |
| POST | /webhooks | Register webhook |

All GET endpoints support `from`, `to`, `limit`, `offset` query params.

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed. See the file for all available options.

## Scripts

```bash
pnpm migrate           # Run SQL migrations
pnpm seed              # Generate and apply seed data
pnpm backfill [s] [e]  # Backfill blocks s..e via BullMQ
pnpm generate-api-key  # Create a new API key
```

## License

MIT
