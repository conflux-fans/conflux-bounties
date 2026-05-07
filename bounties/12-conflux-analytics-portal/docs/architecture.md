# Architecture

## Overview

The Conflux Analytics Portal is a pnpm monorepo with four packages:

1. **shared** — Zod schemas, constants, and utility functions shared across all packages
2. **ingestor** — Connects to Conflux eSpace via viem, fetches blocks/txs/receipts, decodes ERC-20 Transfer logs, stores raw data, and runs periodic aggregations
3. **api** — Fastify REST server exposing aggregated data with Zod validation, Redis caching, rate limiting, and OpenAPI docs
4. **frontend** — React SPA consuming the API via TanStack Query, with Recharts visualizations and Zustand state management

## Data Flow

```
Conflux eSpace RPC
      │
      ▼
  Block Fetcher (viem)
      │
      ▼
  BullMQ Queue ──► Block Processor Worker
      │                    │
      │                    ▼
      │              PostgreSQL (blocks, transactions, token_transfers)
      │                    │
      │                    ▼
      │              Aggregator Worker (every 10 min)
      │                    │
      │                    ▼
      │              Aggregate tables (daily_activity, daily_fees, etc.)
      │                    │
      ▼                    ▼
  Live-tail Poller    Fastify API ──► Redis Cache ──► Frontend
```

## Ingestion Pipeline

### Backfill
Reads the `sync_state` checkpoint, partitions the gap into 10-block chunks, enqueues as BullMQ jobs processed by 5 concurrent workers.

### Live Tail
Polls `eth_blockNumber` every 1s, enqueues new blocks with high priority.

### Reorg Handling
Before inserting, verifies `parent_hash` matches the previous block's `hash` in DB. On mismatch, walks back up to 20 blocks to find the fork point, deletes everything above it (cascades via FK), and re-processes.

### Aggregation
BullMQ repeatable job every 10 minutes. Runs INSERT...ON CONFLICT upserts to recompute all aggregate tables from raw data. Publishes Redis invalidation event.

## Caching Strategy

- Redis response cache with 5-minute TTL on all GET endpoints
- Automatic invalidation via Redis pub/sub when the aggregator completes
- Cache key = `cache:{url}`

## Rate Limiting

- Public: 30 requests/minute (keyed by IP)
- Authenticated: 100 requests/minute (keyed by API key via `x-api-key` header)
