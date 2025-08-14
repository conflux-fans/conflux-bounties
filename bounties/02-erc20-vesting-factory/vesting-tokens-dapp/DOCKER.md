# Docker Setup for Vesting Tokens DApp

This document explains how to use Docker to run the Vesting Tokens DApp in various environments.

## 🐳 Overview

The project includes multiple Docker configurations:
- **Production**: Optimized for production deployment
- **Development**: Optimized for development with hot reloading
- **Database**: PostgreSQL with pgAdmin for database management
- **Caching**: Redis for session and data caching

## 📁 Docker Files

- `Dockerfile` - Production build with multi-stage optimization
- `Dockerfile.dev` - Development build with hot reloading
- `docker-compose.yml` - Full production environment
- `docker-compose.dev.yml` - Development environment
- `.dockerignore` - Optimizes build context

## 🚀 Quick Start

### Prerequisites

- Docker Desktop installed and running
- Docker Compose v2
- At least 4GB RAM available for Docker

### 1. Development Environment (Recommended for development)

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### 2. Production Environment

```bash
# Start production environment
docker-compose up -d

# View logs
docker-compose logs -f app-prod

# Stop services
docker-compose down
```

## 🛠 Development Workflow

### Starting Development Environment

```bash
# Build and start all services
docker-compose -f docker-compose.dev.yml up -d --build

# Start only specific services
docker-compose -f docker-compose.dev.yml up -d postgres redis
docker-compose -f docker-compose.dev.yml up -d app
```

### Hot Reloading

The development environment includes:
- **Volume mounting**: Source code is mounted for live updates
- **Hot reloading**: Next.js automatically reloads on file changes
- **Node modules**: Preserved in container for performance

### Database Setup

```bash
# Run database migrations
docker-compose -f docker-compose.dev.yml run --rm migrate

# Access pgAdmin
# Open http://localhost:5050
# Email: admin@vestingdapp.com
# Password: admin123
```

### Running Tests

```bash
# Run tests in Docker
docker-compose -f docker-compose.dev.yml run --rm test

# Run tests with coverage
docker-compose -f docker-compose.dev.yml run --rm test npm run test:coverage
```

## 🏗 Production Deployment

### Building Production Image

```bash
# Build production image
docker build -t vesting-dapp:latest .

# Build with specific tag
docker build -t vesting-dapp:v1.0.0 .
```

### Running Production Container

```bash
# Run production container
docker run -d \
  --name vesting-dapp-prod \
  -p 3000:3000 \
  -e DATABASE_URL=your_database_url \
  -e NODE_ENV=production \
  vesting-dapp:latest
```

### Production with Docker Compose

```bash
# Start production environment
docker-compose --profile production up -d

# Scale production app
docker-compose --profile production up -d --scale app-prod=3
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Blockchain Configuration
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_wallet_connect_project_id
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS=0x1121C77E3AcC2281982AD91c53702A71E56d6Cd2
NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS=your_sepolia_factory_address

# Database Configuration
DATABASE_URL=postgresql://vesting_user:vesting_password@localhost:5432/vesting_dapp

# Redis Configuration
REDIS_URL=redis://localhost:6379
```

### Port Configuration

Default ports used:
- **App (Dev)**: 3000
- **App (Prod)**: 3001
- **PostgreSQL**: 5432
- **Redis**: 6379
- **pgAdmin**: 5050

To change ports, modify the `docker-compose.yml` files.

## 📊 Services

### Core Services

| Service | Purpose | Port | Profile |
|---------|---------|------|---------|
| `app` | Development app | 3000 | default |
| `app-prod` | Production app | 3001 | production |
| `postgres` | Database | 5432 | default |
| `redis` | Caching | 6379 | default |
| `pgadmin` | Database admin | 5050 | tools |
| `migrate` | Database migrations | - | setup |
| `test` | Testing | - | test |

### Service Dependencies

```
app/app-prod → postgres (healthy)
app/app-prod → redis
pgadmin → postgres
migrate → postgres (healthy)
test → postgres (healthy)
```

## 🧹 Maintenance

### Cleaning Up

```bash
# Remove containers and networks
docker-compose -f docker-compose.dev.yml down

# Remove volumes (WARNING: This deletes all data)
docker-compose -f docker-compose.dev.yml down -v

# Remove images
docker rmi vesting-dapp:latest

# Clean up unused resources
docker system prune -a
```

### Logs and Debugging

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs

# View specific service logs
docker-compose -f docker-compose.dev.yml logs app

# Follow logs in real-time
docker-compose -f docker-compose.dev.yml logs -f app

# Access container shell
docker exec -it vesting-dapp-dev sh
```

### Database Management

```bash
# Access PostgreSQL directly
docker exec -it vesting-dapp-postgres-dev psql -U vesting_user -d vesting_dapp_dev

# Backup database
docker exec vesting-dapp-postgres-dev pg_dump -U vesting_user vesting_dapp_dev > backup.sql

# Restore database
docker exec -i vesting-dapp-postgres-dev psql -U vesting_user -d vesting_dapp_dev < backup.sql
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Check what's using the port
lsof -i :3000

# Kill the process or change the port in docker-compose
```

#### 2. Database Connection Issues

```bash
# Check database health
docker-compose -f docker-compose.dev.yml ps postgres

# View database logs
docker-compose -f docker-compose.dev.yml logs postgres

# Restart database
docker-compose -f docker-compose.dev.yml restart postgres
```

#### 3. Build Failures

```bash
# Clean build cache
docker builder prune

# Rebuild without cache
docker-compose -f docker-compose.dev.yml build --no-cache
```

#### 4. Permission Issues

```bash
# Fix file permissions
sudo chown -R $USER:$USER .

# Fix Docker volume permissions
docker-compose -f docker-compose.dev.yml down
sudo rm -rf postgres_data redis_data
docker-compose -f docker-compose.dev.yml up -d
```

### Performance Optimization

#### 1. Resource Limits

Add to `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
```

#### 2. Volume Optimization

```yaml
volumes:
  - .:/app:delegated
  - /app/node_modules
  - /app/.next
```

## 🚀 Deployment

### Production Deployment

1. **Build the image**:
   ```bash
   docker build -t vesting-dapp:latest .
   ```

2. **Push to registry**:
   ```bash
   docker tag vesting-dapp:latest your-registry/vesting-dapp:latest
   docker push your-registry/vesting-dapp:latest
   ```

3. **Deploy with docker-compose**:
   ```bash
   docker-compose --profile production up -d
   ```

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and push Docker image
        run: |
          docker build -t vesting-dapp:${{ github.sha }} .
          docker push vesting-dapp:${{ github.sha }}
      - name: Deploy to production
        run: |
          docker-compose --profile production up -d
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Next.js Docker Deployment](https://nextjs.org/docs/deployment#docker-image)
- [PostgreSQL Docker](https://hub.docker.com/_/postgres)
- [Redis Docker](https://hub.docker.com/_/redis)

## 🤝 Contributing

When adding new services or modifying Docker configurations:

1. Update this documentation
2. Test both development and production environments
3. Ensure backward compatibility
4. Add appropriate health checks
5. Document any new environment variables 