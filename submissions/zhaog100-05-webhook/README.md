# Conflux Webhook Relay for On-chain Events

A backend listener service that subscribes to specific eSpace contract events and relays them as webhooks to configurable URLs, with templates for Zapier, Make.com, and n8n.

## Features

- **Real-time Event Monitoring** — Polls Conflux eSpace contracts for on-chain events using ethers.js
- **Multi-platform Webhook Templates** — Built-in formatters for Zapier, Make.com, n8n, and generic payloads
- **Reliable Delivery** — SQLite-backed queue with retry logic (exponential backoff) and delivery tracking
- **Rate Limiting** — Built-in concurrency control via Bottleneck
- **Hot Reload** — Configuration changes are picked up automatically
- **REST API** — Health checks, stats, and subscription management endpoints
- **Docker Ready** — Full containerization with docker-compose

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure subscriptions

Copy the example config and edit:

```bash
cp config/events.example.json config/events.json
```

### 3. Run

```bash
# Development
npm run dev

# Production
npm start
```

### 4. Docker

```bash
docker-compose up -d
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service health check and uptime |
| GET | `/stats` | Queue statistics and recent deliveries |
| GET | `/subscriptions` | List active subscriptions |

## Configuration

### JSON Config (`config/events.json`)

```json
{
  "network": {
    "rpcUrl": "https://evm.confluxrpc.com",
    "chainId": 1030
  },
  "subscriptions": [
    {
      "id": "my-subscription",
      "contract": "0xContractAddress",
      "events": ["Transfer"],
      "filters": { "from": "0xOptionalFilterAddress" },
      "webhooks": [
        {
          "url": "https://hooks.zapier.com/hooks/catch/123/abc",
          "format": "zapier",
          "headers": { "Authorization": "Bearer token" },
          "secret": "optional-signing-secret"
        }
      ]
    }
  ],
  "options": {
    "retryAttempts": 3,
    "retryDelay": 1000,
    "maxConcurrentWebhooks": 10,
    "webhookTimeout": 30000,
    "pollInterval": 2000
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONFLUX_RPC_URL` | `https://evm.confluxrpc.com` | Conflux eSpace RPC endpoint |
| `CONFIG_FILE` | `./config/events.json` | Path to config file |
| `LOG_LEVEL` | `info` | Log level (debug/info/warn/error) |
| `PORT` | `3000` | API server port |
| `RETRY_ATTEMPTS` | `3` | Webhook delivery retry attempts |
| `RETRY_DELAY` | `1000` | Base retry delay (ms) |
| `WEBHOOK_TIMEOUT` | `30000` | Webhook request timeout (ms) |

## Webhook Payload Formats

### Zapier
```json
{
  "event": "Transfer",
  "contract": "0x...",
  "blockNumber": 12345,
  "transactionHash": "0xabc...",
  "timestamp": "2025-01-01T12:00:00Z",
  "data": { "from": "0x...", "to": "0x...", "value": "1000000000000000000" }
}
```

### Make.com
```json
{
  "eventType": "Transfer",
  "contractAddress": "0x...",
  "block": { "number": 12345, "timestamp": "..." },
  "transaction": { "hash": "0xabc..." },
  "eventData": { ... }
}
```

### n8n
```json
{
  "json": { "event": "Transfer", "contract": "0x...", ... },
  "pairedItem": { "item": 0 }
}
```

### Generic
```json
{
  "id": "wh_0xabc_0",
  "type": "blockchain.event",
  "source": "conflux-espace-webhook-relay",
  "subscriptionId": "...",
  "event": "Transfer",
  "contract": "0x...",
  "blockNumber": 12345,
  "transactionHash": "0xabc...",
  "timestamp": "...",
  "data": { ... }
}
```

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  eSpace RPC │────▶│ Event Listener│────▶│    Queue    │
│  (ethers.js)│     │  (polling)   │     │  (SQLite)  │
└─────────────┘     └──────────────┘     └─────┬──────┘
                                               │
                                          ┌────▼──────┐
                                          │  Template  │
                                          │  Engine    │
                                          └────┬──────┘
                                               │
                              ┌─────────────────┼─────────────────┐
                              ▼                 ▼                 ▼
                         ┌────────┐       ┌────────┐        ┌────────┐
                         │ Zapier │       │ Make   │        │  n8n   │
                         └────────┘       └────────┘        └────────┘
```

## Testing

```bash
npm test
```

## License

MIT
