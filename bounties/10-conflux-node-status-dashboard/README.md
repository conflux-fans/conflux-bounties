# Conflux Node Status Dashboard

Self-hosted dashboard for monitoring Conflux node health in real time — sync progress, peer counts, gas price, RPC latency, system stats, and alerts.

## Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Dashboard   │◄────►│   Server    │◄────►│ Conflux RPC │
│  (React)     │ WS   │  (Express)  │ HTTP │   Nodes     │
│  Port 5173   │      │  Port 3001  │      │             │
└─────────────┘      └──────┬──────┘      └─────────────┘
                            │
                       ┌────┴────┐
                       │ SQLite  │
                       │  (WAL)  │
                       └─────────┘
```

**Server** — Metrics collector (8 probes), REST API, Socket.IO real-time updates, alerting engine with Slack/email/webhook channels.

**Dashboard** — React + Vite + Tailwind + Recharts. Real-time cards, historical charts, alert timeline, node comparison, CSV export, dark/light theme.

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+

### Development

```bash
# Install dependencies
pnpm install

# Copy config
cp config.example.json config.json
cp .env.example .env

# Start server (polls Conflux RPC, serves API on :3001)
pnpm dev:server

# In another terminal — start dashboard (:5173)
pnpm dev:dashboard
```

### Seed Demo Data

```bash
pnpm seed
```

Populates 5 nodes, 24h of simulated metrics, and sample alert rules.

### Test RPC Connectivity

```bash
pnpm test:rpc
```

### Run Tests

```bash
pnpm test
```

### Docker

```bash
cp .env.example .env   # edit as needed
docker compose up --build
```

- Dashboard: http://localhost:3000
- API: http://localhost:3001
- Health: http://localhost:3001/health

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/nodes` | List all nodes |
| POST | `/api/v1/nodes` | Add a node |
| PATCH | `/api/v1/nodes/:id` | Update a node |
| DELETE | `/api/v1/nodes/:id` | Remove a node |
| GET | `/api/v1/metrics?nodeId=&metricName=&from=&to=` | Query metrics |
| GET | `/api/v1/metrics/latest/:nodeId` | Latest values per metric |
| GET | `/api/v1/metrics/export?nodeId=&from=&to=` | CSV export |
| GET | `/api/v1/alerts` | List triggered alerts |
| POST | `/api/v1/alerts/:id/acknowledge` | Acknowledge an alert |
| POST | `/api/v1/alerts/:id/resolve` | Resolve an alert |
| GET | `/api/v1/alerts/rules` | List alert rules |
| POST | `/api/v1/alerts/rules` | Create alert rule |
| GET | `/health` | Health check |

## WebSocket Events

Connect via Socket.IO to the server port.

| Event | Direction | Description |
|-------|-----------|-------------|
| `subscribe` | Client → Server | Join a node's room (`node:<id>`) |
| `subscribe:all` | Client → Server | Receive all node updates |
| `metrics:update` | Server → Client | Real-time metric data |
| `alert:triggered` | Server → Client | New alert fired |
| `alert:resolved` | Server → Client | Alert condition cleared |

## Probes

| Probe | Metrics | Source |
|-------|---------|--------|
| SyncStatus | `sync_lag`, `is_synced` | `cfx_getStatus` / `eth_syncing` |
| BlockHeight | `block_height` | `cfx_epochNumber` / `eth_blockNumber` |
| GasPrice | `gas_price_gwei` | `cfx_gasPrice` / `eth_gasPrice` |
| PeerCount | `peer_count` | `cfx_getStatus` / `net_peerCount` |
| PendingTx | `pending_tx_count` | `cfx_getStatus` / `txpool_status` |
| RpcLatency | `rpc_latency` | Timed RPC call |
| SystemStats | `cpu_usage`, `memory_usage`, `disk_usage` | `systeminformation` |
| BlockDetail | `block_tx_count`, `gas_utilization` | Block fetch |

## Alert Configuration

Alert rules are defined in `config.json` or created via the API. Conditions: `gt`, `lt`, `lag`, `consecutive_failures`. Channels: `console`, `slack`, `email`, `webhook`.

```json
{
  "name": "High Sync Lag",
  "metric": "sync_lag",
  "condition": "gt",
  "threshold": 500,
  "severity": "critical",
  "cooldownMs": 300000,
  "channels": ["console", "slack"]
}
```

## Tech Stack

- **Runtime**: Node.js 18+ / TypeScript 5 (strict)
- **Backend**: Express 4, Socket.IO 4, better-sqlite3 (WAL mode)
- **Frontend**: React 18, Vite 5, Tailwind CSS 3, Recharts
- **Validation**: Zod
- **RPC**: Raw `fetch()` for `cfx_*` and `eth_*` (no viem/ethers)
- **Alerting**: Slack webhook, SMTP email, generic webhook
- **Deployment**: Docker multi-stage builds + docker-compose

## License

MIT
