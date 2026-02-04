# Bounty #12: Conflux Analytics Portal

## Overview
- **Reward**: $1,200
- **Difficulty**: 🔴 Large
- **Timeline**: 4–5 weeks
- **Type**: Data Engineering, Analytics, Web
- **Status**: 🧪 Experimental / Non-Production
- **Goal**: Build a self-hostable analytics portal that ingests live Conflux data (a fixed set of predefined, read-only metrics, updated every 10~60 minutes) and surfaces dashboards for top contracts, DApps, token holders, fees, and daily activity—think "mini Dune Analytics" focused on Conflux.
- **Note**: The scope of this bounty is fixed and non-extensible. It is strictly limited to the predefined, read-only metrics outlined in the specification.
- **Change Requests**: We’re open to refinements suggested during the claim process; confirm changes before assignment.

## Problem Statement
Teams lack a single pane of glass for Conflux KPIs and often rely on centralized dashboards with limited customization. Open data pipelines and configurable visualizations empower projects to monitor adoption and share public stats.

## Solution Overview
Implement a backend data aggregator that periodically ingests on-chain events (blocks, transactions, logs) plus ConfluxScan APIs into a warehouse, computes a fixed set of predefined metrics (updated every 10~60 minutes), and exposes them via GraphQL/REST. Build a React dashboard with charting, filters, query builder, and CSV export. Include a public API for embedding metrics elsewhere. The system is read-only and focuses on curated, pre-computed metrics rather than ad-hoc querying.

## Core Features
1. **Data Ingestion**: Indexer service using viem/ethers or SubQuery-like stack to pull blocks, txs, token transfers, contract deployments, gas stats. Supports backfill + live tail with reorg handling.
2. **Warehouse & Modeling**: Transform raw data into fact tables (daily activity, fee metrics, top tokens, DApp usage) using DuckDB/ClickHouse/Postgres + dbt or SQLx pipelines. Schedule incremental updates.
3. **Analytics API**: GraphQL or REST layer delivering aggregated metrics, filters (date range, contract, token, chain), pagination, caching, and rate limiting.
4. **Frontend Dashboard**: Vite/React app with Chart.js/ECharts, widget library (time-series, leaderboards, treemaps), saved views, embedding snippet generator, and public share links.
5. **Exports & Automation**: CSV/JSON export endpoints, webhook to push daily digest, optional Slack integration for daily stats.

## Technical Requirements
### Architecture
- Ingestion: Node.js or Go service with queue (Kafka/Redpanda/NATS) for block events, worker pool for decoding logs (ERC20/721/1155).
- Storage: ClickHouse or Postgres + Timescale for metrics; Redis for cache; optional object storage for raw parquet dumps.
- API: Fastify/NestJS GraphQL server with persisted queries, API keys, per-user rate limits, and OpenAPI spec.
- Frontend: React + Vite + Tailwind + TanStack Query; supports light/dark themes, responsive layout, and offline caching for last-viewed dashboard.
- Deployment: Docker Compose (ingestor, DB, API, frontend, cache) + CI pipeline (lint/test/migrate). Optional Helm chart.

### Metrics Catalog (MVP)
- Daily active accounts (senders + recipients).
- Top contracts by tx count, gas used, unique callers.
- Token holder counts + top holders for ERC20s.
- Fee metrics: average gas price, burn, miner tips.
- DApp leaderboard (custom mapping file).
- Pending tx backlog, success/fail rates.

### Data Governance
- Backfill script with checkpointing + resume.
- Reorg handling up to 20 blocks with reconciliation jobs.
- Schema versioning, migration scripts, and data quality tests (Great Expectations/dbt tests).
- Access control: API keys for private dashboards, public endpoints for basic stats.

## Deliverables
1. **Ingestion Pipeline** with backfill CLI, live streaming, retries, metrics, and unit/integration tests.
2. **Data Models & Warehouse**: dbt project or SQL scripts, view definitions, sample queries, retention policy.
3. **Analytics API**: GraphQL/REST server with documentation, rate limiting, caching, and health checks.
4. **Frontend Portal**: Dashboard pages (overview, tokens, contracts, DApps), query builder, saved views, CSV export.
5. **Docs & Ops**: README, architecture diagram, data dictionary, API reference, deployment guide, sample dashboards, automated tests (ingestor + API + UI).

## Acceptance Criteria
- ✅ Ingests and aggregates at least 30 days of historical data plus live tailing with <1 block lag on average.
- ✅ Exposes ≥10 curated metrics via API with filtering/pagination and caches hot queries.
- ✅ UI renders charts/tables for top contracts, tokens, DApps, and daily activity with interactive filters.
- ✅ CSV/JSON export works for any dashboard widget within selected date range.
- ✅ `docker compose up` launches full stack with seeded demo data and docs describe production scaling.

## Example User Flow
1. Operator deploys stack via Docker, sets RPC + API keys.
2. Backfill CLI syncs last 60 days; status view shows progress.
3. Dashboard displays daily activity chart, top contracts table, token holders heatmap.
4. User filters by DApp tag “DEX” and exports CSV for last 14 days.
5. Daily digest webhook posts summary to Slack with top gas spenders.

## Environment & Config
- `CONFLUX_RPC_URL`, `CONFLUXSCAN_API_KEY`
- `CLICKHOUSE_URL` or `DATABASE_URL`
- `REDIS_URL`, `KAFKA_BROKERS`
- `API_JWT_SECRET`, `PUBLIC_API_KEY`
- `FRONTEND_BASE_URL`, `DEFAULT_DAPP_TAGS_JSON`

## Evaluation Criteria
- **Data Accuracy (35%)**: Reorg handling, schema tests, metric validation.
- **Performance (25%)**: Ingestion throughput, query latency, caching effectiveness.
- **UX & Visualization (20%)**: Dashboard clarity, customization, sharing.
- **Documentation & Ops (20%)**: Deployment clarity, data dictionary, runbooks, test automation.

