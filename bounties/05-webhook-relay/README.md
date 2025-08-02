# Conflux Webhook Relay System

A production-ready webhook relay system that monitors Conflux eSpace blockchain events and delivers real-time notifications to external automation platforms like Zapier, Make.com, and n8n.

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

1. Build and start with Docker Compose:
```bash
docker-compose up -d
```

This will start:
- Webhook relay system
- PostgreSQL database
- Redis cache (optional)

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
    "url": "postgresql://user:password@localhost:5432/webhook_relay",
    "poolSize": 20,
    "connectionTimeout": 10000
  },
  "subscriptions": [
    {
      "id": "usdt-transfers",
      "contractAddress": "0x14b2d3bc65e74dae1030eafd8ac30c533c976a9b",
      "eventSignature": "Transfer(address,address,uint256)",
      "filters": {},
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
  ]
}
```

### Environment Variables

You can override configuration values using environment variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `HEALTH_CHECK_PORT`: Port for health check endpoint
- `MAX_CONCURRENT_WEBHOOKS`: Maximum concurrent webhook deliveries

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

```
GET /metrics
```

Returns system metrics in Prometheus format.

## Monitoring and Logging

### Structured Logging

The system uses structured JSON logging:

```json
{
  "level": "info",
  "message": "Event processed successfully",
  "contractAddress": "0x123...",
  "eventName": "Transfer",
  "blockNumber": 12345,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Metrics

Key metrics tracked:
- Events processed per second
- Webhook delivery success rate
- Queue depth
- Response times
- Error rates

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