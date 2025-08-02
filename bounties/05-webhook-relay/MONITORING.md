# Webhook Relay System - Monitoring and Observability Guide

## Overview

The Webhook Relay System includes comprehensive monitoring and observability features to ensure reliable operation in production environments. This guide covers all monitoring capabilities, configuration options, and troubleshooting procedures.

## Features

### 1. Structured Logging with Correlation IDs

The system implements structured logging with automatic correlation ID tracking for request tracing.

#### Configuration

```typescript
import { Logger } from './src/monitoring/Logger';
import { correlationIdManager } from './src/monitoring/CorrelationId';

// Create logger instance
const logger = new Logger({
  level: 'info',
  format: 'json',
  enableConsole: true,
  enableFile: true,
  filename: 'app.log'
});

// Use correlation context
const correlationId = correlationIdManager.generateCorrelationId();
correlationIdManager.run({ correlationId }, () => {
  logger.info('Processing webhook delivery', { webhookId: 'webhook-123' });
});
```

#### Log Format

```json
{
  "timestamp": "2025-08-02T05:13:28.635Z",
  "level": "info",
  "message": "Processing webhook delivery",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "requestId": "req-123",
  "webhookId": "webhook-123"
}
```

### 2. Performance Metrics Collection

The system collects comprehensive performance metrics for monitoring system health and performance.

#### Available Metrics

- **Counters**: Event processing count, webhook delivery count, error count
- **Gauges**: Active connections, queue size, memory usage
- **Histograms**: Response times, processing durations

#### Usage

```typescript
import { MetricsCollector } from './src/monitoring/MetricsCollector';

const metrics = new MetricsCollector();

// Increment counters
metrics.incrementCounter('webhook_deliveries_total', { status: 'success' });

// Record gauge values
metrics.recordGauge('queue_size', 150);

// Record histogram values
metrics.recordHistogram('webhook_response_time', 250);
```

#### Metrics Endpoints

- `GET /metrics` - Prometheus-compatible metrics endpoint
- Metrics are automatically flushed to database every 60 seconds

### 3. Health Check System

Comprehensive health checking with configurable checks and detailed status reporting.

#### Default Health Checks

- **Process**: Basic process health
- **Memory**: Memory usage monitoring
- **Database**: Database connectivity
- **Disk Space**: Available disk space

#### Health Check Endpoints

- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed health information with system metrics

#### Health Status Response

```json
{
  "status": "healthy",
  "checks": {
    "process": true,
    "memory": true,
    "database": true,
    "disk_space": true
  },
  "timestamp": "2025-08-02T05:13:28.635Z",
  "system": {
    "uptime": 3600,
    "memory": {
      "used": 134217728,
      "total": 268435456,
      "usage": 50.0
    },
    "cpu": {
      "usage": {
        "user": 1000000,
        "system": 500000
      },
      "loadAverage": [0.5, 0.3, 0.2]
    },
    "platform": "linux",
    "nodeVersion": "v18.17.0"
  }
}
```

#### Custom Health Checks

```typescript
import { HealthChecker } from './src/monitoring/HealthChecker';

const healthChecker = new HealthChecker();

// Register custom health check
healthChecker.registerHealthCheck(
  'external_api',
  async () => {
    // Check external API connectivity
    const response = await fetch('https://api.example.com/health');
    return response.ok;
  },
  {
    timeout: 5000,
    critical: true,
    description: 'External API connectivity'
  }
);
```

### 4. Alert Management

Automated alerting system with configurable rules and multiple notification channels.

#### Alert Rules

The system includes default alert rules for:

- Critical system failures
- System degradation
- High memory usage
- Database connectivity issues

#### Alert Channels

Supported notification channels:

- **Console**: Log-based alerts
- **Webhook**: HTTP webhook notifications
- **Email**: Email notifications (requires configuration)
- **Slack**: Slack webhook notifications

#### Configuration

```typescript
import { alertManager } from './src/monitoring/AlertManager';

// Add custom alert rule
alertManager.addRule({
  id: 'high-error-rate',
  name: 'High Error Rate',
  condition: (status) => {
    // Custom condition logic
    return status.checks.database === false;
  },
  severity: 'high',
  cooldownMs: 10 * 60 * 1000, // 10 minutes
  enabled: true
});

// Add webhook alert channel
alertManager.addChannel({
  name: 'ops-webhook',
  type: 'webhook',
  config: {
    url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  enabled: true
});
```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=true

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_PORT=3001

# Alerting
ALERT_WEBHOOK_URL=https://your-alert-webhook.com/alerts
```

### Configuration File

```json
{
  "monitoring": {
    "logLevel": "info",
    "metricsEnabled": true,
    "healthCheckPort": 3001,
    "alerting": {
      "enabled": true,
      "channels": {
        "webhook": {
          "url": "https://your-alert-webhook.com/alerts"
        }
      }
    }
  }
}
```

## Monitoring Dashboards

### Key Metrics to Monitor

1. **System Health**
   - Overall system status
   - Component health status
   - Uptime percentage

2. **Performance Metrics**
   - Webhook delivery success rate
   - Average response times
   - Event processing rate
   - Queue size and processing time

3. **Error Metrics**
   - Error rate by component
   - Failed webhook deliveries
   - Circuit breaker activations

4. **Resource Usage**
   - Memory usage
   - CPU usage
   - Database connections
   - Disk space

### Grafana Dashboard Example

```json
{
  "dashboard": {
    "title": "Webhook Relay System",
    "panels": [
      {
        "title": "System Health",
        "type": "stat",
        "targets": [
          {
            "expr": "webhook_system_health_status"
          }
        ]
      },
      {
        "title": "Webhook Success Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(webhook_deliveries_total{status=\"success\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting

### Common Issues

#### 1. High Memory Usage

**Symptoms**: Memory usage alerts, slow performance
**Diagnosis**: Check memory metrics and heap dumps
**Solutions**:
- Increase memory limits
- Check for memory leaks
- Optimize queue processing

```bash
# Check memory usage
curl http://localhost:3001/health | jq '.system.memory'

# Monitor memory over time
watch -n 5 'curl -s http://localhost:3001/health | jq ".system.memory.usage"'
```

#### 2. Database Connection Issues

**Symptoms**: Database health check failures, connection errors
**Diagnosis**: Check database connectivity and pool status
**Solutions**:
- Verify database credentials
- Check network connectivity
- Increase connection pool size

```bash
# Check database health
curl http://localhost:3001/health | jq '.checks.database'

# Check detailed database metrics
curl http://localhost:3001/metrics | grep database
```

#### 3. High Error Rate

**Symptoms**: Increased error metrics, failed webhook deliveries
**Diagnosis**: Check error logs and metrics
**Solutions**:
- Review webhook endpoint configurations
- Check network connectivity
- Verify authentication credentials

```bash
# Check error rate
curl http://localhost:3001/metrics | grep error_total

# Check recent error logs
tail -f app.log | grep '"level":"error"'
```

#### 4. Queue Backlog

**Symptoms**: Increasing queue size, delayed webhook deliveries
**Diagnosis**: Monitor queue metrics and processing rates
**Solutions**:
- Increase concurrent processing limits
- Optimize webhook endpoints
- Scale horizontally

```bash
# Check queue size
curl http://localhost:3001/metrics | grep queue_size

# Monitor processing rate
curl http://localhost:3001/metrics | grep processing_rate
```

### Log Analysis

#### Finding Correlation IDs

```bash
# Find all logs for a specific correlation ID
grep "correlationId\":\"550e8400-e29b-41d4-a716-446655440000" app.log

# Find failed webhook deliveries
grep '"level":"error"' app.log | grep webhook
```

#### Performance Analysis

```bash
# Find slow webhook deliveries
grep '"responseTime"' app.log | awk -F'"responseTime":' '{print $2}' | awk -F',' '{print $1}' | sort -n | tail -10

# Find most common errors
grep '"level":"error"' app.log | jq -r '.message' | sort | uniq -c | sort -nr
```

### Debugging Steps

1. **Check System Health**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Review Recent Logs**
   ```bash
   tail -100 app.log | jq '.'
   ```

3. **Check Metrics**
   ```bash
   curl http://localhost:3001/metrics
   ```

4. **Verify Configuration**
   ```bash
   cat config.json | jq '.monitoring'
   ```

5. **Test Webhook Endpoints**
   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"test": true}' https://your-webhook-endpoint.com
   ```

## Production Deployment

### Monitoring Setup Checklist

- [ ] Configure structured logging with appropriate log levels
- [ ] Set up metrics collection and storage
- [ ] Configure health check endpoints
- [ ] Set up alerting rules and notification channels
- [ ] Create monitoring dashboards
- [ ] Set up log aggregation and analysis
- [ ] Configure automated backup and recovery
- [ ] Test alert notifications
- [ ] Document runbook procedures

### Recommended Monitoring Stack

- **Metrics**: Prometheus + Grafana
- **Logs**: ELK Stack (Elasticsearch, Logstash, Kibana) or Loki
- **Alerting**: Prometheus Alertmanager or PagerDuty
- **APM**: Jaeger or Zipkin for distributed tracing

### Performance Tuning

1. **Optimize Log Levels**: Use appropriate log levels for production
2. **Metrics Sampling**: Configure metrics sampling for high-volume environments
3. **Health Check Intervals**: Adjust health check frequencies based on requirements
4. **Alert Thresholds**: Fine-tune alert thresholds to reduce noise

## Support

For additional support and troubleshooting:

1. Check the application logs for detailed error information
2. Review the health check endpoints for system status
3. Monitor the metrics endpoints for performance data
4. Consult this documentation for common issues and solutions
5. Contact the development team with correlation IDs for specific issues