# Bounty #10: Conflux Node Status Dashboard

## Overview
- **Reward**: $1,000
- **Difficulty**: 🟡 Medium
- **Timeline**: 3–4 weeks
- **Type**: Observability, DevOps, UI
- **Status**: 🧪 Experimental / Non-Production
- **Goal**: Ship a self-hosted dashboard that tracks Conflux node health in real time (seconds-level updates)—sync progress, peer counts, gas price, RPC latency, disk usage, and alerts—targeting operators of local or public RPC nodes.
- **Change Requests**: Spec feedback is welcome during the claim discussion; finalize adjustments before assignment.

## Problem Statement
Node operators juggle CLI scripts and explorer pages to understand health, often missing early warnings on sync stalls or latency spikes. A lightweight, customizable dashboard with alerting improves reliability and accelerates incident response.

## Solution Overview
Build a two-part system: (1) Metrics Collector that polls Conflux JSON-RPC and OS stats, pushing normalized metrics to a time-series store, and (2) Dashboard UI (React + Chart.js) with WebSocket updates, historical charts, alerts, and multi-node support. Provide Docker packaging for quick deployment on the same machine as the node or remote watcher.

## Core Features
1. **Metric Ingestion**: Polls `cfx_getStatus`, `cfx_getBlockByNumber`, `txpool_status`, peer info, disk/CPU/RAM stats, RPC latency tests, and exposes Prometheus-compatible metrics.
2. **Alerting Engine**: Threshold + trend alerts (e.g., sync lag > 500 blocks, peer count < 5, latency > 3s). Supports email/Slack/webhook notifications with dedup + cooldowns.
3. **Dashboard UI**: Realtime cards (sync %, peers, gas price, TPS), historical charts (CPU, latency, block lag), logs panel, node comparison view, dark/light themes.
4. **WebSocket Updates**: Collector pushes updates via Socket.IO/SSE; UI reflects changes without refresh.
5. **Config & Auth**: Role-based access for operators vs viewers, API keys for remote agents, .env-driven thresholds.

## Technical Requirements
### Architecture
- Collector: Node.js or Go service with modular probe system; cron-like scheduler, retries, exponential backoff, caching.
- Storage: PostgreSQL + TimescaleDB, InfluxDB, or lightweight SQLite for MVP; must support retention policies and pruning.
- API Server: NestJS/Fastify exposing REST + WebSocket endpoints for metrics, alerts, node management.
- Frontend: React (Vite) + Chart.js/Recharts + Tailwind; responsive layout, aggregated stats, download CSV button.
- Deployment: Dockerfile + docker-compose including collector, API, DB, and frontend. Optional Kubernetes manifests.

### Metrics & Probes
- Sync status, current epoch/block height, best pivot hash.
- Peer count, peer identities, ban scores.
- Gas price, base fee, pending tx count.
- RPC latency & error rate (periodic test queries).
- System stats: CPU, RAM, disk usage, network throughput (via Node Exporter or native module).
- Custom script hook to add new probes without redeploy.

### Alerts & Notifications
- YAML/JSON config with thresholds and evaluation windows.
- Alert deduplication + acknowledgment workflow in UI.
- Integrations: Slack webhook, email (SMTP), PagerDuty-compatible webhook.
- Maintenance mode to silence alerts during upgrades.

## Deliverables
1. **Metrics Collector** with plugin architecture, config file, and unit tests.
2. **Backend API** providing `/metrics`, `/alerts`, `/nodes`, WebSocket stream, and health check endpoint.
3. **Dashboard UI** featuring node list, detail view, charts, alert timeline, and CSV export.
4. **Deployment Toolkit**: Docker Compose, systemd service sample, TLS reverse proxy instructions.
5. **Docs & Tests**: README, env sample, probe writing guide, alert configuration guide, automated tests (collector + API + UI components).

## Acceptance Criteria
- ✅ Collector tracks at least 5 nodes concurrently with <5% CPU overhead.
- ✅ Dashboard updates key metrics in ≤2 seconds after collector push.
- ✅ Alerts fire and notify via Slack/email when thresholds breached, with acknowledgment flow.
- ✅ CSV export provides selectable date range and metric.
- ✅ `docker compose up` bootstraps entire stack with seed data for demo.

## Example User Flow
1. Operator adds node RPC URL + SSH stats credentials via UI.
2. Collector verifies access, schedules probes, and begins publishing metrics.
3. Dashboard shows sync progress and peer counts; user sets alert for low peers.
4. Peer count drops; alert triggers Slack notification. Operator acknowledges in UI, investigates.
5. Historical chart exports CSV for weekly report.

## Environment & Config
- `CONFLUX_RPC_URLS` (comma-separated), `NODE_LABELS_JSON`
- `DATABASE_URL`, `REDIS_URL` (if using caching/queues)
- `ALERT_SLACK_WEBHOOK`, `SMTP_URL`, `PAGERDUTY_ROUTING_KEY`
- `JWT_SECRET`, `API_KEY_SEED`
- `METRIC_INTERVAL_MS`, `RETENTION_DAYS`

## Evaluation Criteria
- **Reliability (35%)**: Probe accuracy, fault tolerance, alert delivery, test coverage.
- **UX & Visualization (25%)**: Clarity of charts, responsiveness, accessibility, multi-node support.
- **Deployability (20%)**: Docker setup, config ergonomics, docs, upgrade story.
- **Extensibility (20%)**: Plugin system, custom probes, API quality for external dashboards.

