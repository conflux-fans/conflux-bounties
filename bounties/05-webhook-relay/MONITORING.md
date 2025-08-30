# Monitoring Guide

This document provides comprehensive monitoring setup and configuration for the Conflux Webhook Relay System.

[中文文档](MONITORING.zh-CN.md)

## Overview

The system provides built-in monitoring capabilities including:
- Health check endpoints
- Metrics collection and exposure
- Structured logging
- Performance monitoring
- Database metrics tracking

## Health Checks

### Basic Health Check

```http
GET /health
```

Returns basic system health status:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Detailed Health Check

The system monitors the health of key components:
- Database connectivity
- Blockchain connection
- Queue processing status

## Metrics Collection

### Available Metrics

The system exposes metrics at the `/metrics` endpoint in Prometheus format. Based on the actual implementation, the following metrics are available:

#### Database Metrics
- `database_connections_active` - Number of active database connections
- `database_connections_idle` - Number of idle database connections
- `database_query_duration_seconds` - Database query execution time
- `database_errors_total` - Total database errors

#### Webhook Processing Metrics
- `webhook_events_processed_total` - Total number of blockchain events processed
- `webhook_deliveries_attempted_total` - Total webhook delivery attempts
- `webhook_deliveries_successful_total` - Successful webhook deliveries
- `webhook_deliveries_failed_total` - Failed webhook deliveries
- `webhook_delivery_duration_seconds` - Webhook delivery response time
- `webhook_queue_size` - Current queue size
- `webhook_retry_attempts_total` - Total retry attempts

#### System Metrics
- `process_cpu_user_seconds_total` - Process CPU time in user mode
- `process_cpu_system_seconds_total` - Process CPU time in system mode
- `process_resident_memory_bytes` - Process resident memory size
- `nodejs_heap_size_total_bytes` - Total heap size
- `nodejs_heap_size_used_bytes` - Used heap size

### Metrics Endpoint

```http
GET /metrics
```

Example response:
```prometheus
# HELP webhook_events_processed_total Total number of blockchain events processed
# TYPE webhook_events_processed_total counter
webhook_events_processed_total 1234

# HELP webhook_deliveries_attempted_total Total webhook delivery attempts
# TYPE webhook_deliveries_attempted_total counter
webhook_deliveries_attempted_total 1150

# HELP webhook_delivery_duration_seconds Webhook delivery response time
# TYPE webhook_delivery_duration_seconds histogram
webhook_delivery_duration_seconds_bucket{le="0.1"} 850
webhook_delivery_duration_seconds_bucket{le="0.5"} 1100
webhook_delivery_duration_seconds_bucket{le="1"} 1140
webhook_delivery_duration_seconds_bucket{le="+Inf"} 1150
webhook_delivery_duration_seconds_sum 245.5
webhook_delivery_duration_seconds_count 1150

# HELP database_connections_active Number of active database connections
# TYPE database_connections_active gauge
database_connections_active 5
```

## Prometheus Configuration

### Basic Setup

The included `monitoring/prometheus.yml` provides a basic Prometheus configuration:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'webhook-relay'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
```

### Docker Compose Integration

Add Prometheus to your Docker Compose setup:

```yaml
version: '3.8'
services:
  webhook-relay:
    # ... your webhook relay service config
    
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
```

## Grafana Dashboards

### Setup

1. Start Grafana:
```bash
docker run -d -p 3000:3000 --name grafana grafana/grafana
```

2. Access Grafana at `http://localhost:3000` (admin/admin)

3. Add Prometheus as a data source:
   - URL: `http://prometheus:9090` (if using Docker Compose)
   - URL: `http://localhost:9090` (if running locally)

### Key Dashboards

#### System Overview Dashboard

Monitor overall system health:
- Event processing rate
- Webhook delivery success rate
- Queue depth over time
- Error rates
- Response time percentiles

#### Performance Dashboard

Track performance metrics:
- CPU and memory usage
- Database connection pool utilization
- Webhook delivery latency distribution
- Throughput metrics

#### Error Analysis Dashboard

Monitor and analyze errors:
- Error rate trends
- Failed webhook deliveries by endpoint
- Database connection errors
- Retry attempt patterns

### Sample Queries

#### Event Processing Rate
```promql
rate(webhook_events_processed_total[5m])
```

#### Webhook Success Rate
```promql
rate(webhook_deliveries_successful_total[5m]) / rate(webhook_deliveries_attempted_total[5m]) * 100
```

#### 95th Percentile Response Time
```promql
histogram_quantile(0.95, rate(webhook_delivery_duration_seconds_bucket[5m]))
```

#### Queue Depth
```promql
webhook_queue_size
```

## Logging

### Log Levels

The system supports the following log levels:
- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages (default)
- `debug`: Debug-level messages

Set log level via environment variable:
```bash
LOG_LEVEL=debug npm start
```

### Log Format

Structured JSON logging format:

```json
{
  "level": "info",
  "message": "Event processed successfully",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "correlationId": "req-123456",
  "contractAddress": "0x1207bd45c1002dC88bf592Ced9b35ec914bCeb4e",
  "eventName": "Transfer",
  "blockNumber": 12345,
  "transactionHash": "0xabc123...",
  "processingTime": 150
}
```

### Log Aggregation

For production deployments, consider using:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Fluentd** for log collection
- **Grafana Loki** for log aggregation

## Alerting

### Recommended Alerts

#### High Error Rate
```promql
rate(webhook_deliveries_failed_total[5m]) / rate(webhook_deliveries_attempted_total[5m]) > 0.05
```

#### Queue Backlog
```promql
webhook_queue_size > 1000
```

#### Database Connection Issues
```promql
database_connections_active / database_connections_total > 0.9
```

#### High Response Time
```promql
histogram_quantile(0.95, rate(webhook_delivery_duration_seconds_bucket[5m])) > 5
```

#### Memory Usage
```promql
process_resident_memory_bytes / 1024 / 1024 > 512
```

### Alert Manager Configuration

Example Alertmanager rules:

```yaml
groups:
  - name: webhook-relay
    rules:
      - alert: HighErrorRate
        expr: rate(webhook_deliveries_failed_total[5m]) / rate(webhook_deliveries_attempted_total[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High webhook delivery error rate"
          description: "Webhook delivery error rate is {{ $value | humanizePercentage }}"

      - alert: QueueBacklog
        expr: webhook_queue_size > 1000
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Webhook queue backlog"
          description: "Queue size is {{ $value }} items"
```

## Performance Monitoring

### Key Performance Indicators (KPIs)

1. **Throughput**: Events processed per second
2. **Latency**: End-to-end processing time
3. **Availability**: System uptime percentage
4. **Error Rate**: Failed operations percentage
5. **Queue Health**: Queue depth and processing rate

### Monitoring Checklist

- [ ] Prometheus scraping webhook relay metrics
- [ ] Grafana dashboards configured
- [ ] Alert rules defined and tested
- [ ] Log aggregation setup
- [ ] Health check monitoring
- [ ] Database performance monitoring
- [ ] Network connectivity monitoring

## Troubleshooting

### Common Issues

#### Metrics Not Available
- Verify the `/metrics` endpoint is accessible
- Check Prometheus configuration and connectivity
- Ensure the application is running and healthy

#### High Memory Usage
- Monitor heap usage metrics
- Check for memory leaks in event processing
- Review queue size and processing rate

#### Database Connection Issues
- Monitor database connection pool metrics
- Check database server health
- Review connection timeout settings

### Debug Commands

```bash
# Check metrics endpoint
curl http://localhost:3000/metrics

# Check health status
curl http://localhost:3000/health

# View application logs with debug level
LOG_LEVEL=debug npm start

# Monitor database connections
# (Check database_connections_active metric)
```

## Production Deployment

### Monitoring Stack

For production deployments, deploy a complete monitoring stack:

```yaml
version: '3.8'
services:
  webhook-relay:
    # ... your service config
    
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
      
  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      
  alertmanager:
    image: prom/alertmanager:latest
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
    ports:
      - "9093:9093"

volumes:
  prometheus_data:
  grafana_data:
```

### Security Considerations

- Secure metrics endpoints with authentication
- Use HTTPS for external monitoring access
- Implement proper firewall rules
- Regular security updates for monitoring components

## Best Practices

1. **Monitor Key Business Metrics**: Focus on metrics that matter for your use case
2. **Set Appropriate Alert Thresholds**: Avoid alert fatigue with well-tuned thresholds
3. **Use Correlation IDs**: Track requests across system components
4. **Regular Health Checks**: Implement comprehensive health checks
5. **Capacity Planning**: Monitor trends for capacity planning
6. **Documentation**: Keep monitoring documentation up to date

## Support

For monitoring-related issues:
- Check the troubleshooting section
- Review Prometheus and Grafana documentation
- Create an issue on GitHub with monitoring logs