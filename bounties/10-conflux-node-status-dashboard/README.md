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

Demo data (5 nodes, 24h of metrics) is auto-seeded on first run. Set `SEED_DEMO_DATA=false` in docker-compose.yml to disable.

- Dashboard: http://localhost:3000
- API: http://localhost:3001
- Prometheus metrics: http://localhost:3001/metrics
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
| GET | `/metrics` | Prometheus-format metrics |
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

## Prometheus Metrics

Metrics are exposed at `GET /metrics` in Prometheus text exposition format. Scrape config example:

```yaml
scrape_configs:
  - job_name: conflux-dashboard
    scrape_interval: 15s
    static_configs:
      - targets: ["localhost:3001"]
```

## Deployment

### Docker (recommended)

```bash
cp .env.example .env   # edit as needed
docker compose up --build
```

On first run the server automatically seeds 5 demo nodes with 24 hours of simulated metrics. Set `SEED_DEMO_DATA=false` to disable.

- Dashboard: http://localhost:3000
- API: http://localhost:3001
- Prometheus metrics: http://localhost:3001/metrics
- Health: http://localhost:3001/health

### systemd Service

Create `/etc/systemd/system/conflux-dashboard.service`:

```ini
[Unit]
Description=Conflux Node Status Dashboard
After=network.target

[Service]
Type=simple
User=dashboard
WorkingDirectory=/opt/conflux-dashboard
EnvironmentFile=/opt/conflux-dashboard/.env
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now conflux-dashboard
sudo systemctl status conflux-dashboard
```

Serve the dashboard frontend with nginx (see TLS section below) or any static file server pointing at `dashboard/dist/`.

### TLS Reverse Proxy (nginx)

Install certbot and obtain certificates, then configure nginx:

```nginx
server {
    listen 80;
    server_name dashboard.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name dashboard.example.com;

    ssl_certificate     /etc/letsencrypt/live/dashboard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.example.com/privkey.pem;

    # Dashboard SPA
    location / {
        root /opt/conflux-dashboard/dashboard/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Prometheus metrics
    location /metrics {
        proxy_pass http://127.0.0.1:3001;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3001;
    }
}
```

```bash
sudo certbot --nginx -d dashboard.example.com
sudo systemctl reload nginx
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
