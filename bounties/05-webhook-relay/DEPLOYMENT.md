# Deployment Guide

This guide covers deploying the Webhook Relay System using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- At least 10GB disk space

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd webhook-relay-system
```

### 2. Create Configuration

Copy the example configuration and customize it:

```bash
cp config.example.json config.json
```

Edit `config.json` with your specific settings:
- Update `network.rpcUrl` and `network.wsUrl` for your Conflux network
- Configure your contract subscriptions
- Set up webhook endpoints

### 3. Environment Variables

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` with your environment-specific values.

### 4. Start Services

For production deployment:

```bash
docker-compose up -d
```

For development with hot reload:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d webhook-relay-dev
```

### 5. Verify Deployment

Check service health:

```bash
# Check all services
docker-compose ps

# Check application health
curl http://localhost:3001/health

# Check logs
docker-compose logs -f webhook-relay
```

## Production Deployment

### Environment Setup

1. **Database Configuration**
   ```bash
   # Use a strong password
   export POSTGRES_PASSWORD=$(openssl rand -base64 32)
   
   # Update docker-compose.yml with the password
   ```

2. **Redis Configuration**
   ```bash
   # Use a strong password
   export REDIS_PASSWORD=$(openssl rand -base64 32)
   
   # Update docker-compose.yml with the password
   ```

3. **SSL/TLS Setup**
   - Use a reverse proxy (nginx, traefik) for SSL termination
   - Configure proper certificates
   - Update health check URLs to use HTTPS

### Resource Limits

Update `docker-compose.yml` to add resource limits:

```yaml
services:
  webhook-relay:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Monitoring Setup

1. **Health Checks**
   ```bash
   # Application health
   curl http://localhost:3001/health
   
   # Metrics (if enabled)
   curl http://localhost:3001/metrics
   ```

2. **Log Management**
   ```bash
   # View logs
   docker-compose logs -f webhook-relay
   
   # Log rotation (add to docker-compose.yml)
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```

### Backup Strategy

1. **Database Backup**
   ```bash
   # Create backup
   docker-compose exec postgres pg_dump -U webhook_user webhook_relay > backup.sql
   
   # Restore backup
   docker-compose exec -T postgres psql -U webhook_user webhook_relay < backup.sql
   ```

2. **Configuration Backup**
   ```bash
   # Backup configuration
   cp config.json config.backup.json
   ```

## Development Deployment

### Hot Reload Development

```bash
# Start with development override
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View development logs
docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f webhook-relay-dev
```

### Database Management

Access pgAdmin at http://localhost:8080:
- Email: admin@webhook-relay.local
- Password: admin123

Access Redis Commander at http://localhost:8081

### Testing

```bash
# Run tests in container
docker-compose exec webhook-relay npm test

# Run tests with coverage
docker-compose exec webhook-relay npm run test:coverage
```

## Scaling

### Horizontal Scaling

```yaml
services:
  webhook-relay:
    deploy:
      replicas: 3
    # Add load balancer configuration
```

### Database Scaling

For high-load scenarios:
1. Use PostgreSQL read replicas
2. Implement connection pooling (PgBouncer)
3. Consider database sharding for very high loads

### Redis Scaling

For high-load scenarios:
1. Use Redis Cluster
2. Implement Redis Sentinel for high availability

## Troubleshooting

### Common Issues

1. **Application Won't Start**
   ```bash
   # Check logs
   docker-compose logs webhook-relay
   
   # Check configuration
   docker-compose exec webhook-relay cat /app/config.json
   ```

2. **Database Connection Issues**
   ```bash
   # Check database health
   docker-compose exec postgres pg_isready -U webhook_user
   
   # Check database logs
   docker-compose logs postgres
   ```

3. **High Memory Usage**
   ```bash
   # Check container stats
   docker stats
   
   # Adjust memory limits in docker-compose.yml
   ```

### Health Check Endpoints

- **Application Health**: `GET /health`
  - Returns 200 for healthy, 503 for unhealthy
  - Includes component status and uptime

- **Metrics**: `GET /metrics` (if enabled)
  - Returns application metrics in JSON format

### Log Analysis

```bash
# Filter logs by level
docker-compose logs webhook-relay | grep ERROR

# Follow logs in real-time
docker-compose logs -f --tail=100 webhook-relay

# Export logs for analysis
docker-compose logs --no-color webhook-relay > app.log
```

## Security Considerations

### Production Security

1. **Network Security**
   - Use Docker networks to isolate services
   - Don't expose database ports to host in production
   - Use firewall rules to restrict access

2. **Secrets Management**
   - Use Docker secrets or external secret management
   - Don't store secrets in environment variables
   - Rotate passwords regularly

3. **Container Security**
   - Run containers as non-root user (already configured)
   - Keep base images updated
   - Scan images for vulnerabilities

### Example Production docker-compose.yml

```yaml
version: '3.8'

services:
  webhook-relay:
    image: webhook-relay:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    secrets:
      - db_password
      - redis_password
    networks:
      - internal
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G

  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    secrets:
      - db_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - internal
    # Don't expose ports in production

secrets:
  db_password:
    external: true
  redis_password:
    external: true

networks:
  internal:
    driver: bridge
    internal: true
```

## Maintenance

### Updates

1. **Application Updates**
   ```bash
   # Pull latest image
   docker-compose pull webhook-relay
   
   # Restart with new image
   docker-compose up -d webhook-relay
   ```

2. **Database Migrations**
   ```bash
   # Run migrations
   docker-compose exec webhook-relay npm run migrate:up
   ```

### Cleanup

```bash
# Remove unused images
docker image prune

# Remove unused volumes (be careful!)
docker volume prune

# Remove unused networks
docker network prune
```

## Support

For issues and questions:
1. Check the logs first
2. Verify configuration
3. Check health endpoints
4. Review this deployment guide
5. Create an issue in the repository