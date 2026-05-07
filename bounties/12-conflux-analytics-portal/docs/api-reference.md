# API Reference

Base URL: `http://localhost:3001/api/v1`

## Common Parameters

All GET endpoints accept:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| from | string | — | Start date (YYYY-MM-DD) |
| to | string | — | End date (YYYY-MM-DD) |
| limit | number | 50 | Max rows (1-1000) |
| offset | number | 0 | Pagination offset |

## Authentication

Pass `x-api-key` header for authenticated access (100 req/min vs 30 req/min).

## Endpoints

### GET /health
Returns sync status.

```json
{ "status": "ok", "lastBlock": 80000099, "updatedAt": "2025-01-01T00:00:00Z" }
```

### GET /activity/daily
Daily transaction counts and active accounts.

```json
{
  "data": [
    { "date": "2025-01-01", "tx_count": 25000, "active_accounts": 3000, "new_contracts": 15, "total_gas_used": "2500000000" }
  ]
}
```

### GET /fees/daily
Daily gas fee aggregates.

```json
{
  "data": [
    { "date": "2025-01-01", "avg_gas_price": "1500000000", "total_burned": "500000000000", "total_tips": "100000000000", "tx_count": 25000 }
  ]
}
```

### GET /contracts/top
Top contracts sorted by `sort` param.

Additional params: `sort` (tx_count|gas_used|unique_callers), `order` (asc|desc)

```json
{
  "data": [
    { "contract_address": "0x...", "tx_count": 5000, "unique_callers": 200, "gas_used": "100000000", "dapp_name": "Swappi DEX", "category": "DeFi" }
  ]
}
```

### GET /contracts/:addr/stats
Per-contract daily breakdown.

### GET /tokens
Token list with transfer counts and holder counts.

```json
{
  "data": [
    { "address": "0x...", "name": "USDT", "symbol": "USDT", "decimals": 18, "transfer_count": 1000, "holder_count": 500 }
  ]
}
```

### GET /tokens/:addr/holders
Top holders for a token, sorted by balance descending.

### GET /tokens/:addr/stats
Per-token daily transfer statistics.

### GET /dapps/leaderboard
DApp rankings. Additional param: `category` (optional filter).

### GET /network/overview
```json
{ "latestBlock": 80000099, "tps": 12.5, "totalTransactions": 500000, "avgBlockTime": 1.2 }
```

### GET /transactions/stats
```json
{ "totalSuccess": 490000, "totalFailure": 10000, "successRate": 0.98 }
```

### GET /export/:widget
Download data as CSV or JSON. Param: `format` (csv|json). Widget names: activity, fees, contracts, tokens, dapps.

### POST /shares
Create a shareable view.

```json
// Request
{ "config": { "page": "overview", "from": "2025-01-01" }, "expiresInDays": 30 }
// Response
{ "slug": "abc12345", "url": "/s/abc12345" }
```

### GET /shares/:slug
Load a saved shared view config.

### POST /webhooks
Register a webhook.

```json
// Request
{ "url": "https://example.com/hook", "eventType": "daily_digest" }
// Response
{ "id": "uuid", "url": "...", "event_type": "daily_digest", "active": true, "created_at": "..." }
```
