# Deployment Guide

## Docker Compose (Recommended)

The entire stack runs with a single command:

```bash
cd bounties/12-conflux-analytics-portal
docker compose up --build
```

This starts:
- **PostgreSQL** (TimescaleDB) on port 5432
- **Redis** on port 6379
- **init** — runs migrations and seeds the database, then exits
- **ingestor** — starts block ingestion and aggregation
- **api** — Fastify REST server on port 3001
- **frontend** — Nginx serving the React app on port 5173

### First Run

On first `docker compose up`:
1. PostgreSQL initializes with the `conflux_analytics` database
2. The `init` service runs all 5 migrations and applies seed data
3. The dashboard is immediately usable with 30 days of demo data

### Stopping

```bash
docker compose down       # Stop containers
docker compose down -v    # Stop and remove volumes (resets database)
```

## Local Development

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Install dependencies
pnpm install

# Start databases
docker compose up postgres redis -d

# Run migrations
pnpm migrate

# Seed demo data
pnpm seed

# Start services
pnpm dev:api        # API on :3001
pnpm dev:ingestor   # Block ingestion
pnpm dev:frontend   # Vite dev server on :5173
```

## Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| CONFLUX_RPC_URL | https://evm.confluxrpc.com | Conflux eSpace RPC |
| POSTGRES_HOST | localhost | PostgreSQL host |
| POSTGRES_PASSWORD | analytics_secret | PostgreSQL password |
| REDIS_HOST | localhost | Redis host |
| API_PORT | 3001 | API server port |
| VITE_API_URL | http://localhost:3001/api/v1 | Frontend API base URL |

## Production Considerations

- Use a dedicated PostgreSQL instance with TimescaleDB extension
- Enable SSL on PostgreSQL and Redis connections
- Set strong `POSTGRES_PASSWORD` and API key values
- Consider a reverse proxy (nginx, Caddy) with TLS in front of the API
- Monitor the ingestor logs for reorg alerts deeper than 20 blocks
- Tune `INGESTOR_CONCURRENCY` and `INGESTOR_RATE_LIMIT` based on RPC provider limits
