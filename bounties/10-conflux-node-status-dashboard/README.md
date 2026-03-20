# Conflux Node Status Dashboard

Self-hosted observability dashboard for Conflux node operators.

## Features
- Real-time metrics: sync progress, block height, peers, TPS, gas price
- System monitoring: CPU, RAM, disk usage
- WebSocket live updates
- Multi-node support
- Alerting with configurable thresholds
- Dark-themed responsive UI with charts

## Quick Start
```bash
docker compose up -d
# Visit http://localhost:3001
```

## Architecture
- **API Server**: Fastify with WebSocket support
- **Collector**: Polls Conflux JSON-RPC for node metrics
- **Storage**: SQLite for time-series data
- **Frontend**: React + Recharts + Tailwind CSS

## Conflux RPC
- Mainnet: https://mainnet.confluxrpc.com
- Testnet: https://testnet.confluxrpc.com

Closes #16
