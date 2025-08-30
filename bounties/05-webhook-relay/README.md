# Conflux Webhook Relay System

A production-ready webhook relay system that monitors Conflux eSpace blockchain events and delivers real-time notifications to external automation platforms like Zapier, Make.com, and n8n.

[中文文档](README.zh-CN.md)

## Features

- **Real-time Event Monitoring**: Monitor smart contract events on Conflux eSpace with sub-30 second detection
- **Multi-Platform Support**: Native formatting for Zapier, Make.com, n8n, and generic webhooks
- **Reliable Delivery**: Queue-based delivery system with exponential backoff retry logic
- **Production Ready**: Docker deployment, PostgreSQL persistence, comprehensive monitoring
- **Hot Configuration Reload**: Update subscriptions without system restart
- **Circuit Breaker Pattern**: Automatic failure detection and recovery for webhook endpoints

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 12+
- Docker (optional)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd webhook-relay-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create database
createdb webhook_relay

# Run migrations
npm run migrate
```

4. Create configuration file:
```bash
cp config.example.json config.json
# Edit config.json with your settings
```

5. Start the system:
```bash
npm start
```

### Docker Deployment

#### Production Environment

1. Build and start with Docker Compose:
```bash
docker-compose up -d
```

This will start:
- Webhook relay system (port 3001)
- PostgreSQL database (port 5432)
- Redis cache (port 6379)

#### Development Environment

1. Start development environment:
```bash
npm run docker:dev
```

This will start:
- Development webhook relay system (port 3000 for app, port 3002 for health checks)
- Production webhook relay system (port 3001)
- PostgreSQL database (port 5432)
- Redis cache (port 6379)

2. Check development health:
```bash
npm run docker:dev:health
```

3. View development logs:
```bash
npm run docker:dev:logs
```

4. Stop development environment:
```bash
npm run docker:dev:down
```

## Configuration

### Basic Configuration

Create a `config.json` file based on the example:

```json
{
  "network": {
    "rpcUrl": "https://evm.confluxrpc.com",
    "wsUrl": "wss://evm.confluxrpc.com/ws",
    "chainId": 1030,
    "confirmations": 1
  },
  "database": {
    "url": "postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay",
    "poolSize": 20,
    "connectionTimeout": 10000
  },
  "subscriptions": [
    {
      "id": "usdt-transfers",
      "contractAddress": "0x1207bd45c1002dC88bf592Ced9b35ec914bCeb4e",
      "eventSignature": "Transfer(address,address,uint256)",
      "filters": {},
      "webhooks": [
        {
          "id": "hookdeck-webhook",
          "url": "https://hkdk.events/m0t8gxe2jfe4j91",
          "format": "generic",
          "headers": {
            "Content-Type": "application/json"
          },
          "timeout": 30000,
          "retryAttempts": 3
        }
      ]
    }
  ]
}
```

### Environment Variables

You can override configuration values using environment variables:

- `DATABASE_URL`: PostgreSQL connection string (required)
- `REDIS_URL`: Redis connection string (optional - for caching and queue optimization)
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `HEALTH_CHECK_PORT`: Port for health check endpoint
- `MAX_CONCURRENT_WEBHOOKS`: Maximum concurrent webhook deliveries

**Note**: Redis is completely optional. The system will operate without Redis using database-only storage for all functionality.

### Event Filters

Filter events using various operators:

```json
{
  "filters": {
    "value": {
      "operator": "gt",
      "value": "1000000000000000000"
    },
    "from": "0x1234567890123456789012345678901234567890",
    "to": {
      "operator": "in",
      "value": ["0xabc...", "0xdef..."]
    }
  }
}
```

Supported operators:
- `eq`: Equal to
- `ne`: Not equal to
- `gt`: Greater than
- `lt`: Less than
- `in`: In array
- `contains`: Contains substring

## Platform Integration Guides

### Zapier Integration

1. Create a new Zap in Zapier
2. Choose "Webhooks by Zapier" as the trigger
3. Select "Catch Hook" 
4. Copy the webhook URL
5. Add to your configuration:

```json
{
  "webhooks": [
    {
      "id": "zapier-webhook",
      "url": "https://hooks.zapier.com/hooks/catch/123456/abcdef/",
      "format": "zapier",
      "headers": {
        "Content-Type": "application/json"
      },
      "timeout": 30000,
      "retryAttempts": 3
    }
  ]
}
```

The system will format events in Zapier's expected format with flattened fields.

### Make.com Integration

1. Create a new scenario in Make.com
2. Add a "Webhooks" module
3. Choose "Custom webhook"
4. Copy the webhook URL
5. Add to your configuration:

```json
{
  "webhooks": [
    {
      "id": "make-webhook",
      "url": "https://hook.eu1.make.com/your-webhook-id",
      "format": "make",
      "headers": {
        "Content-Type": "application/json"
      },
      "timeout": 30000,
      "retryAttempts": 3
    }
  ]
}
```

### n8n Integration

1. Create a new workflow in n8n
2. Add a "Webhook" node
3. Set the HTTP method to POST
4. Copy the webhook URL
5. Add to your configuration:

```json
{
  "webhooks": [
    {
      "id": "n8n-webhook",
      "url": "https://your-n8n-instance.com/webhook/your-webhook-id",
      "format": "n8n",
      "headers": {
        "Content-Type": "application/json"
      },
      "timeout": 30000,
      "retryAttempts": 3
    }
  ]
}
```

## API Endpoints

### Health Check

```
GET /health
```

Returns system health status:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "components": {
    "database": "healthy",
    "blockchain": "healthy",
    "queue": "healthy"
  }
}
```

### Metrics

```http
GET /metrics
```

Returns system metrics in Prometheus format. The system collects comprehensive metrics including:

#### Available Metrics

- `webhook_events_processed_total` - Total number of blockchain events processed
- `webhook_deliveries_total` - Total webhook delivery attempts  
- `webhook_delivery_success_total` - Successful webhook deliveries
- `webhook_delivery_failure_total` - Failed webhook deliveries
- `webhook_response_time_ms` - Webhook delivery response time histogram
- `queue_size` - Current queue size
- `database_connections_active` - Active database connections
- `memory_heap_used_bytes` - Memory heap usage
- `process_uptime_seconds` - Process uptime

#### Example Response

```prometheus
# HELP webhook_events_processed_total Total number of blockchain events processed
# TYPE webhook_events_processed_total counter
webhook_events_processed_total 1234

# HELP webhook_deliveries_total Total webhook delivery attempts
# TYPE webhook_deliveries_total counter
webhook_deliveries_total{webhook_id="hookdeck-webhook"} 1150

# HELP webhook_response_time_ms Webhook delivery response time
# TYPE webhook_response_time_ms histogram
webhook_response_time_ms{webhook_id="hookdeck-webhook"} 245.5

# HELP queue_size Current queue size
# TYPE queue_size gauge
queue_size 15
```

## Monitoring and Observability

The system includes comprehensive monitoring capabilities with structured logging, metrics collection, health checks, and alerting. For detailed monitoring setup, see [MONITORING.md](MONITORING.md).

### Quick Monitoring Setup

1. **Check System Health**:
```bash
curl http://localhost:3000/health
```

2. **View Metrics**:
```bash
curl http://localhost:3000/metrics
```

3. **Enable Debug Logging**:
```bash
LOG_LEVEL=debug npm start
```

## Monitoring and Logging

### Structured Logging

The system uses structured JSON logging with correlation ID tracking:

```json
{
  "timestamp": "2025-08-02T05:13:28.635Z",
  "level": "info",
  "message": "Event processed successfully",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "contractAddress": "0x1207bd45c1002dC88bf592Ced9b35ec914bCeb4e",
  "eventName": "Transfer",
  "blockNumber": 12345,
  "transactionHash": "0xabc123...",
  "processingTime": 150
}
```

#### Log Levels

- `error`: Error conditions
- `warn`: Warning conditions  
- `info`: Informational messages (default)
- `debug`: Debug-level messages

Set log level via environment variable:
```bash
LOG_LEVEL=debug npm start
```

### Key Performance Indicators

The system tracks comprehensive metrics for monitoring:

#### Performance Metrics
- **Events processed per second**: Real-time event processing rate
- **Webhook delivery success rate**: Percentage of successful deliveries
- **Average response time**: Mean webhook endpoint response time
- **Queue processing rate**: Items processed from queue per second

#### Reliability Metrics  
- **Error rate by component**: Failed operations by system component
- **Circuit breaker activations**: Automatic failure protection triggers
- **Retry attempt patterns**: Analysis of delivery retry behavior

#### Resource Metrics
- **Memory usage**: Heap and RSS memory consumption
- **CPU utilization**: Process CPU time in user/system mode
- **Database connections**: Active/idle connection pool status
- **Queue depth**: Current backlog size and processing capacity

### Alerting

Configure alerts for:
- High error rates
- Queue backlog
- Webhook endpoint failures
- Database connection issues

## Development

### Running Tests

```bash
# Unit tests
npm test

# Integration tests (requires database)
npm run test:integration

# E2E tests (requires Conflux testnet access)
CONFLUX_TESTNET_TESTS=true npm run test:e2e
```

### Code Coverage

```bash
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify PostgreSQL is running
- Check connection string in configuration
- Ensure database exists and migrations are run

**Webhook Delivery Failures**
- Check webhook endpoint is accessible
- Verify authentication headers
- Review webhook format compatibility

**High Memory Usage**
- Monitor queue depth
- Check for memory leaks in event processing
- Adjust `maxConcurrentWebhooks` setting

**Blockchain Connection Issues**
- Verify RPC/WebSocket URLs are correct
- Check network connectivity
- Monitor for rate limiting

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm start
```

### Performance Tuning

For high-volume deployments:

1. Increase database connection pool size
2. Adjust `maxConcurrentWebhooks` based on your infrastructure
3. Use Redis for caching (optional)
4. Scale horizontally with multiple instances

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting guide
- Review the configuration examples