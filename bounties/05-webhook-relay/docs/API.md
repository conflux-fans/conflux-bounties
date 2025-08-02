# API Documentation

The Conflux Webhook Relay System provides REST API endpoints for monitoring and management.

## Health Check Endpoint

### GET /health

Returns the current health status of the system.

**Response:**

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "components": {
    "config": true,
    "database": true,
    "healthChecker": true,
    "blockchain": true,
    "queue": true
  },
  "version": "1.0.0"
}
```

**Status Codes:**
- `200 OK` - System is healthy
- `503 Service Unavailable` - System is unhealthy

**Component Status:**
- `config`: Configuration system status
- `database`: Database connection status
- `healthChecker`: Health monitoring system status
- `blockchain`: Blockchain connection status
- `queue`: Webhook delivery queue status

## Metrics Endpoint

### GET /metrics

Returns system metrics in JSON format.

**Response:**

```json
{
  "events": {
    "processed_total": 1234,
    "processed_per_second": 2.5,
    "processing_time_avg_ms": 150,
    "errors_total": 5
  },
  "webhooks": {
    "delivered_total": 1200,
    "failed_total": 34,
    "success_rate": 0.972,
    "delivery_time_avg_ms": 250,
    "queue_depth": 15
  },
  "database": {
    "connections_active": 8,
    "connections_total": 20,
    "query_time_avg_ms": 25
  },
  "system": {
    "memory_usage_mb": 256,
    "cpu_usage_percent": 15,
    "uptime_seconds": 3600
  }
}
```

**Metrics Categories:**

1. **Events**: Blockchain event processing metrics
2. **Webhooks**: Webhook delivery metrics
3. **Database**: Database performance metrics
4. **System**: System resource usage metrics

## Configuration Management

### GET /config

Returns the current system configuration (sensitive data redacted).

**Response:**

```json
{
  "network": {
    "rpcUrl": "https://evm.confluxrpc.com",
    "chainId": 1030,
    "confirmations": 1
  },
  "subscriptions": [
    {
      "id": "token-transfers",
      "contractAddress": "0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b",
      "eventSignature": "Transfer(address,address,uint256)",
      "webhooks": [
        {
          "id": "zapier-webhook",
          "url": "https://hooks.zapier.com/hooks/catch/***",
          "format": "zapier"
        }
      ]
    }
  ],
  "options": {
    "maxConcurrentWebhooks": 10,
    "defaultRetryAttempts": 3
  }
}
```

### POST /config/reload

Triggers a configuration reload without restarting the system.

**Request:**
```bash
curl -X POST http://localhost:3001/config/reload
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration reloaded successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Configuration reloaded successfully
- `400 Bad Request` - Configuration validation failed
- `500 Internal Server Error` - Reload failed

## Queue Management

### GET /queue/status

Returns the current status of the webhook delivery queue.

**Response:**

```json
{
  "depth": 15,
  "processing": 3,
  "pending": 12,
  "failed": 0,
  "completed_last_hour": 450,
  "average_processing_time_ms": 200
}
```

### GET /queue/deliveries

Returns recent webhook deliveries with pagination.

**Query Parameters:**
- `limit` (optional): Number of results to return (default: 50, max: 200)
- `offset` (optional): Number of results to skip (default: 0)
- `status` (optional): Filter by status (pending, processing, completed, failed)

**Request:**
```bash
curl "http://localhost:3001/queue/deliveries?limit=10&status=failed"
```

**Response:**

```json
{
  "deliveries": [
    {
      "id": "uuid-1234",
      "subscriptionId": "token-transfers",
      "webhookId": "zapier-webhook",
      "status": "failed",
      "attempts": 3,
      "maxAttempts": 3,
      "lastAttempt": "2024-01-15T10:25:00.000Z",
      "errorMessage": "HTTP 503: Service Unavailable",
      "createdAt": "2024-01-15T10:20:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 10,
    "offset": 0,
    "hasMore": false
  }
}
```

### POST /queue/retry/{deliveryId}

Manually retry a failed webhook delivery.

**Request:**
```bash
curl -X POST http://localhost:3001/queue/retry/uuid-1234
```

**Response:**
```json
{
  "success": true,
  "message": "Delivery queued for retry",
  "deliveryId": "uuid-1234"
}
```

## Subscription Management

### GET /subscriptions

Returns all configured event subscriptions.

**Response:**

```json
{
  "subscriptions": [
    {
      "id": "token-transfers",
      "contractAddress": "0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b",
      "eventSignature": "Transfer(address,address,uint256)",
      "filters": {},
      "webhooks": [
        {
          "id": "zapier-webhook",
          "format": "zapier",
          "active": true
        }
      ],
      "active": true,
      "createdAt": "2024-01-15T09:00:00.000Z"
    }
  ]
}
```

### GET /subscriptions/{subscriptionId}/stats

Returns statistics for a specific subscription.

**Response:**

```json
{
  "subscriptionId": "token-transfers",
  "stats": {
    "events_processed_total": 500,
    "events_processed_last_hour": 25,
    "webhooks_delivered_total": 485,
    "webhooks_failed_total": 15,
    "success_rate": 0.97,
    "last_event_processed": "2024-01-15T10:29:00.000Z"
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid subscription ID",
    "details": {
      "field": "subscriptionId",
      "value": "invalid-id"
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req-uuid-5678"
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR` - Request validation failed
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Internal server error
- `SERVICE_UNAVAILABLE` - Service temporarily unavailable

## Authentication

Currently, the API endpoints are not authenticated. For production deployments, consider:

1. **API Key Authentication**
   ```bash
   curl -H "X-API-Key: your-api-key" http://localhost:3001/health
   ```

2. **JWT Authentication**
   ```bash
   curl -H "Authorization: Bearer jwt-token" http://localhost:3001/health
   ```

3. **IP Whitelisting**
   - Configure firewall rules
   - Use reverse proxy for access control

## Rate Limiting

API endpoints have built-in rate limiting:

- **Health Check**: 60 requests per minute
- **Metrics**: 30 requests per minute
- **Configuration**: 10 requests per minute
- **Queue Management**: 20 requests per minute

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642248600
```

## Monitoring Integration

### Prometheus Metrics

The `/metrics` endpoint can be configured to return Prometheus-compatible metrics:

```bash
curl -H "Accept: text/plain" http://localhost:3001/metrics
```

**Response:**
```
# HELP webhook_events_processed_total Total number of events processed
# TYPE webhook_events_processed_total counter
webhook_events_processed_total 1234

# HELP webhook_deliveries_total Total number of webhook deliveries
# TYPE webhook_deliveries_total counter
webhook_deliveries_total{status="success"} 1200
webhook_deliveries_total{status="failed"} 34

# HELP webhook_queue_depth Current webhook queue depth
# TYPE webhook_queue_depth gauge
webhook_queue_depth 15
```

### Health Check Integration

The health check endpoint is designed for use with:

- **Docker health checks**
- **Kubernetes liveness/readiness probes**
- **Load balancer health checks**
- **Monitoring systems (Nagios, Zabbix, etc.)**

Example Docker health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1
```

Example Kubernetes probe:
```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
  initialDelaySeconds: 30
  periodSeconds: 10
```

## Client Libraries

### JavaScript/Node.js

```javascript
const axios = require('axios');

class WebhookRelayClient {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  async getHealth() {
    const response = await axios.get(`${this.baseUrl}/health`);
    return response.data;
  }

  async getMetrics() {
    const response = await axios.get(`${this.baseUrl}/metrics`);
    return response.data;
  }

  async reloadConfig() {
    const response = await axios.post(`${this.baseUrl}/config/reload`);
    return response.data;
  }

  async getQueueStatus() {
    const response = await axios.get(`${this.baseUrl}/queue/status`);
    return response.data;
  }
}

// Usage
const client = new WebhookRelayClient();
const health = await client.getHealth();
console.log('System status:', health.status);
```

### Python

```python
import requests

class WebhookRelayClient:
    def __init__(self, base_url='http://localhost:3001'):
        self.base_url = base_url

    def get_health(self):
        response = requests.get(f'{self.base_url}/health')
        response.raise_for_status()
        return response.json()

    def get_metrics(self):
        response = requests.get(f'{self.base_url}/metrics')
        response.raise_for_status()
        return response.json()

    def reload_config(self):
        response = requests.post(f'{self.base_url}/config/reload')
        response.raise_for_status()
        return response.json()

# Usage
client = WebhookRelayClient()
health = client.get_health()
print(f"System status: {health['status']}")
```

### cURL Examples

```bash
# Check system health
curl -s http://localhost:3001/health | jq .

# Get metrics
curl -s http://localhost:3001/metrics | jq .

# Reload configuration
curl -X POST http://localhost:3001/config/reload

# Get queue status
curl -s http://localhost:3001/queue/status | jq .

# Get failed deliveries
curl -s "http://localhost:3001/queue/deliveries?status=failed&limit=10" | jq .

# Retry a delivery
curl -X POST http://localhost:3001/queue/retry/uuid-1234
```

## OpenAPI Specification

The complete OpenAPI 3.0 specification is available at `/api-docs` when the system is running in development mode.

```bash
curl http://localhost:3001/api-docs
```

This provides a complete machine-readable API specification that can be used with tools like:
- Swagger UI
- Postman
- API testing tools
- Code generators