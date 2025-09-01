# Troubleshooting Guide

This guide helps you diagnose and fix common issues with the Conflux Webhook Relay System.

## Quick Diagnostics

### System Health Check

```bash
# Check application health
curl http://localhost:3001/health

# Check all Docker services
docker-compose ps

# Check application logs
docker-compose logs -f webhook-relay

# Check database connectivity
docker-compose exec postgres pg_isready -U webhook_user
```

### Configuration Validation

```bash
# Validate configuration file
node -e "console.log(JSON.parse(require('fs').readFileSync('config.json', 'utf8')))"

# Check environment variables
docker-compose exec webhook-relay env | grep -E "(DATABASE|REDIS|LOG)"
```

## Common Issues

### 1. Database Connection Failures

**Symptoms:**
- `ECONNREFUSED 127.0.0.1:5432` errors
- Application fails to start
- Health check returns database: false

**Diagnosis:**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test database connection
docker-compose exec postgres psql -U webhook_user -d webhook_relay -c "SELECT 1;"
```

**Solutions:**

1. **Database not running:**
   ```bash
   docker-compose up -d postgres
   ```

2. **Wrong connection string:**
   ```bash
   # Check DATABASE_URL in .env file
   cat .env | grep DATABASE_URL
   
   # Update if incorrect
   DATABASE_URL=postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay
   ```

3. **Database doesn't exist:**
   ```bash
   # Create database
   docker-compose exec postgres createdb -U webhook_user webhook_relay
   
   # Run migrations
   docker-compose exec webhook-relay npm run migrate
   ```

4. **Connection pool exhaustion:**
   ```json
   // Increase pool size in config.json
   {
     "database": {
       "poolSize": 50,
       "connectionTimeout": 10000
     }
   }
   ```

### 2. Webhook Delivery Failures

**Symptoms:**
- Webhooks not being delivered
- High error rates in logs
- `HTTP 503: Service Unavailable` errors

**Diagnosis:**
```bash
# Check webhook delivery logs
docker-compose logs webhook-relay | grep "webhook_delivery"

# Check queue depth
docker-compose logs webhook-relay | grep "queue_depth"

# Test webhook endpoint manually
curl -X POST https://your-webhook-url \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Solutions:**

1. **Webhook endpoint unreachable:**
   - Verify URL is correct and accessible
   - Check firewall rules
   - Test with curl or Postman

2. **Authentication issues:**
   ```json
   // Add proper headers in config.json
   {
     "webhooks": [{
       "headers": {
         "Authorization": "Bearer your-token",
         "Content-Type": "application/json"
       }
     }]
   }
   ```

3. **Timeout issues:**
   ```json
   // Increase timeout in config.json
   {
     "webhooks": [{
       "timeout": 30000,
       "retryAttempts": 5
     }]
   }
   ```

4. **Rate limiting:**
   ```json
   // Reduce concurrent webhooks
   {
     "options": {
       "maxConcurrentWebhooks": 5
     }
   }
   ```

### 3. Blockchain Connection Issues

**Symptoms:**
- Events not being detected
- Connection errors in logs
- WebSocket connection failures

**Diagnosis:**
```bash
# Check blockchain connection logs
docker-compose logs webhook-relay | grep "blockchain"

# Test RPC endpoint
curl -X POST https://evm.confluxrpc.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Test WebSocket endpoint
wscat -c wss://evm.confluxrpc.com/ws
```

**Solutions:**

1. **RPC endpoint issues:**
   ```json
   // Try alternative endpoints in config.json
   {
     "network": {
       "rpcUrl": "https://evm.confluxrpc.com",
       "wsUrl": "wss://evm.confluxrpc.com/ws"
     }
   }
   ```

2. **Network connectivity:**
   - Check internet connection
   - Verify firewall allows outbound connections
   - Test with different RPC providers

3. **Rate limiting:**
   - Use your own RPC node
   - Implement request throttling
   - Add delays between requests

### 4. High Memory Usage

**Symptoms:**
- Container using excessive memory
- Out of memory errors
- Slow performance

**Diagnosis:**
```bash
# Check memory usage
docker stats webhook-relay

# Check Node.js heap usage
docker-compose logs webhook-relay | grep "memory"

# Check for memory leaks
docker-compose exec webhook-relay node --expose-gc -e "
  setInterval(() => {
    global.gc();
    console.log(process.memoryUsage());
  }, 5000);
"
```

**Solutions:**

1. **Increase memory limit:**
   ```yaml
   # In docker-compose.yml
   services:
     webhook-relay:
       deploy:
         resources:
           limits:
             memory: 2G
   ```

2. **Optimize Node.js settings:**
   ```yaml
   # In docker-compose.yml
   services:
     webhook-relay:
       environment:
         - NODE_OPTIONS=--max-old-space-size=1024
   ```

3. **Reduce queue size:**
   ```json
   // In config.json
   {
     "options": {
       "maxQueueSize": 1000,
       "queueProcessingInterval": 100
     }
   }
   ```

### 5. Configuration Issues

**Symptoms:**
- Application fails to start
- Invalid configuration errors
- Hot reload not working

**Diagnosis:**
```bash
# Validate JSON syntax
cat config.json | jq .

# Check configuration loading
docker-compose logs webhook-relay | grep "configuration"

# Check file permissions
ls -la config.json
```

**Solutions:**

1. **Invalid JSON:**
   ```bash
   # Use jq to validate and format
   cat config.json | jq . > config.json.tmp && mv config.json.tmp config.json
   ```

2. **Missing required fields:**
   ```json
   // Ensure all required fields are present
   {
     "network": {
       "rpcUrl": "required",
       "chainId": "required"
     },
     "database": {
       "url": "required"
     },
     "subscriptions": []
   }
   ```

3. **File permissions:**
   ```bash
   # Fix permissions
   chmod 644 config.json
   chown $(whoami):$(whoami) config.json
   ```

### 6. Performance Issues

**Symptoms:**
- Slow event processing
- High CPU usage
- Delayed webhook delivery

**Diagnosis:**
```bash
# Check CPU usage
docker stats webhook-relay

# Check processing times
docker-compose logs webhook-relay | grep "processing_time"

# Check queue backlog
docker-compose logs webhook-relay | grep "queue_depth"
```

**Solutions:**

1. **Optimize database queries:**
   ```sql
   -- Add indexes for better performance
   CREATE INDEX CONCURRENTLY idx_deliveries_status_next_retry 
   ON deliveries(status, next_retry) WHERE status = 'pending';
   ```

2. **Increase processing concurrency:**
   ```json
   // In config.json
   {
     "options": {
       "maxConcurrentWebhooks": 20,
       "queueProcessingInterval": 500
     }
   }
   ```

3. **Scale horizontally:**
   ```yaml
   # In docker-compose.yml
   services:
     webhook-relay:
       deploy:
         replicas: 3
   ```

## Error Messages Reference

### Database Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Database not running | Start PostgreSQL service |
| `password authentication failed` | Wrong credentials | Check DATABASE_URL |
| `database does not exist` | Database not created | Create database and run migrations |
| `too many clients` | Connection pool exhausted | Increase pool size |

### Network Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `ENOTFOUND` | DNS resolution failed | Check network connectivity |
| `ECONNRESET` | Connection reset | Check firewall rules |
| `ETIMEDOUT` | Request timeout | Increase timeout values |
| `certificate verify failed` | SSL certificate issues | Check certificate validity |

### Application Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Configuration validation failed` | Invalid config | Validate configuration file |
| `Event processing failed` | Event parsing error | Check event signature |
| `Webhook delivery failed` | Endpoint unreachable | Test webhook URL |
| `Queue processing failed` | Database issues | Check database connectivity |

## Debug Mode

### Enable Debug Logging

```bash
# Set debug log level
export LOG_LEVEL=debug

# Or in docker-compose.yml
environment:
  - LOG_LEVEL=debug

# Restart application
docker-compose restart webhook-relay
```

### Debug Specific Components

```bash
# Debug database operations
export DEBUG=webhook-relay:database

# Debug webhook delivery
export DEBUG=webhook-relay:webhooks

# Debug event processing
export DEBUG=webhook-relay:events

# Debug all components
export DEBUG=webhook-relay:*
```

### Performance Profiling

```bash
# Enable Node.js profiling
docker-compose exec webhook-relay node --prof app.js

# Generate profile report
docker-compose exec webhook-relay node --prof-process isolate-*.log > profile.txt
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Application Health**
   - Health check endpoint status
   - Uptime and restart frequency
   - Memory and CPU usage

2. **Database Performance**
   - Connection pool utilization
   - Query response times
   - Active connections

3. **Webhook Delivery**
   - Success/failure rates
   - Response times
   - Queue depth

4. **Event Processing**
   - Events processed per second
   - Processing latency
   - Error rates

### Setting Up Alerts

```yaml
# Example Prometheus alerting rules
groups:
  - name: webhook-relay
    rules:
      - alert: WebhookRelayDown
        expr: up{job="webhook-relay"} == 0
        for: 1m
        
      - alert: HighErrorRate
        expr: rate(webhook_errors_total[5m]) > 0.1
        for: 2m
        
      - alert: QueueBacklog
        expr: webhook_queue_depth > 1000
        for: 5m
```

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Review application logs
3. Verify configuration
4. Test with minimal configuration
5. Check system resources

### Information to Include

When reporting issues, include:

1. **System Information**
   - Operating system
   - Docker version
   - Available memory/CPU

2. **Configuration**
   - Sanitized config.json
   - Environment variables (without secrets)
   - Docker Compose version

3. **Logs**
   - Application logs (last 100 lines)
   - Database logs if relevant
   - Error messages with timestamps

4. **Steps to Reproduce**
   - What you were trying to do
   - What happened instead
   - Minimal reproduction case

### Log Collection Script

```bash
#!/bin/bash
# collect-logs.sh - Collect diagnostic information

echo "=== System Information ===" > diagnostic.log
uname -a >> diagnostic.log
docker --version >> diagnostic.log
docker-compose --version >> diagnostic.log

echo -e "\n=== Service Status ===" >> diagnostic.log
docker-compose ps >> diagnostic.log

echo -e "\n=== Application Logs ===" >> diagnostic.log
docker-compose logs --tail=100 webhook-relay >> diagnostic.log

echo -e "\n=== Database Logs ===" >> diagnostic.log
docker-compose logs --tail=50 postgres >> diagnostic.log

echo -e "\n=== Configuration ===" >> diagnostic.log
cat config.json | jq . >> diagnostic.log

echo "Diagnostic information saved to diagnostic.log"
```

## Recovery Procedures

### Application Recovery

```bash
# Restart application
docker-compose restart webhook-relay

# Full restart with fresh containers
docker-compose down
docker-compose up -d

# Reset to clean state
docker-compose down -v
docker-compose up -d
```

### Database Recovery

```bash
# Restore from backup
docker-compose exec -T postgres psql -U webhook_user webhook_relay < backup.sql

# Reset database
docker-compose exec postgres dropdb -U webhook_user webhook_relay
docker-compose exec postgres createdb -U webhook_user webhook_relay
docker-compose exec webhook-relay npm run migrate
```

### Configuration Recovery

```bash
# Restore from backup
cp config.backup.json config.json

# Reset to default
cp config.example.json config.json
# Edit with your settings
```