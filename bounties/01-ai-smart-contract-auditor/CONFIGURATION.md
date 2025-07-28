# Environment Configuration Guide

Complete guide for configuring the AI Smart Contract Auditor environment variables.

## Quick Setup

```bash
# 1. Copy the example file
cp .env.example .env.local

# 2. Edit with your API keys
nano .env.local  # or use your preferred editor

# 3. Start the application
npm run dev
```

## Required Configuration

### AI API Keys (Choose at least one)

#### OpenAI API Key
- **Purpose**: GPT-4 powered vulnerability analysis
- **How to get**: 
  1. Go to [OpenAI Platform](https://platform.openai.com/account/api-keys)
  2. Sign up/login to your account
  3. Create a new secret key
  4. Copy the key (starts with `sk-`)
- **Add to `.env.local`**:
  ```env
  OPENAI_API_KEY=sk-your-actual-openai-key-here
  ```

#### Anthropic API Key  
- **Purpose**: Claude powered vulnerability analysis
- **How to get**:
  1. Go to [Anthropic Console](https://console.anthropic.com/)
  2. Sign up/login to your account
  3. Create a new API key
  4. Copy the key (starts with `sk-ant-`)
- **Add to `.env.local`**:
  ```env
  ANTHROPIC_API_KEY=sk-ant-your-actual-anthropic-key-here
  ```

### ConfluxScan API
- **Purpose**: Fetching smart contract source code
- **Configuration**: Use the public API endpoint
- **Add to `.env.local`**:
  ```env
  CONFLUXSCAN_API_KEY=https://evmapi.confluxscan.org
  ```
- **Note**: No API key needed for public contracts

### Database Configuration

Choose one of these database setups:

#### Option 1: Docker PostgreSQL (Recommended)
```env
DATABASE_URL="postgresql://postgres:mypassword123@localhost:5555/audit_db?schema=public"
```

#### Option 2: Local PostgreSQL Installation
```env
DATABASE_URL="postgresql://your_username:your_password@localhost:5432/audit_db?schema=public"
```

#### Option 3: Vercel Postgres (Production)
```env
# This will be automatically provided by Vercel
DATABASE_URL="postgres://default:xxx@xxx.postgres.vercel-storage.com:5432/verceldb?sslmode=require"
```

## Optional Configuration

### Application Settings

```env
# Base URL for your application
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Environment mode
NODE_ENV=development  # or production

# Server port (optional)
PORT=3000
```

### Security Configuration

```env
# JWT Secret for authentication (generate a random 256-bit string)
JWT_SECRET=your-super-long-random-secret-key-here

# Webhook HMAC secret for secure webhook delivery
WEBHOOK_SECRET=your-webhook-secret-key-here
```

#### Generating Secure Secrets
```bash
# Generate JWT secret (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate webhook secret (OpenSSL)
openssl rand -hex 32
```

### Rate Limiting

```env
# API requests per minute per IP
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Webhook requests per minute per IP
RATE_LIMIT_WEBHOOK_REQUESTS_PER_MINUTE=30
```

### Monitoring (Optional)

```env
# Sentry DSN for error tracking
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## Docker-Specific Configuration

If using Docker deployment, add these optional variables:

```env
# Redis cache URL
REDIS_URL=redis://redis:6379

# Vector database for advanced features
VECTOR_DB_URL=postgres://vector_user:vector_pass@vector-db:5432/vector_db

# Docker Compose project name
COMPOSE_PROJECT_NAME=smart-contract-auditor
```

## Environment Files Overview

### `.env.example`
- Template file with all possible variables
- Safe to commit to version control
- Contains documentation and examples

### `.env.local`
- Your actual configuration with real API keys
- **NEVER commit this to version control**
- Contains sensitive information

### `.env`
- Alternative to `.env.local`
- Also contains sensitive information
- **NEVER commit this to version control**

## Deployment-Specific Configuration

### Local Development
```env
NODE_ENV=development
NEXT_PUBLIC_BASE_URL=http://localhost:3000
DATABASE_URL="postgresql://postgres:mypassword123@localhost:5555/audit_db?schema=public"
```

### Production Deployment
```env
NODE_ENV=production
NEXT_PUBLIC_BASE_URL=https://your-domain.com
DATABASE_URL="your-production-database-url"
JWT_SECRET=your-super-secure-production-secret
WEBHOOK_SECRET=your-production-webhook-secret
```

### Vercel Deployment
```env
# Vercel automatically provides:
# - DATABASE_URL (from Vercel Postgres)
# - POSTGRES_URL, POSTGRES_PRISMA_URL, etc.

# You need to manually add:
OPENAI_API_KEY=sk-your-key
ANTHROPIC_API_KEY=sk-ant-your-key
CONFLUXSCAN_API_KEY=https://evmapi.confluxscan.org
JWT_SECRET=your-secret
WEBHOOK_SECRET=your-webhook-secret
```

## Troubleshooting

### Common Issues

#### "Missing API Key" Error
- Ensure you have at least one AI API key configured
- Check that the key starts with the correct prefix (`sk-` for OpenAI, `sk-ant-` for Anthropic)
- Verify the key is active and has credits/usage available

#### Database Connection Error
- Verify PostgreSQL is running (for local setup)
- Check the DATABASE_URL format is correct
- Ensure the database exists and is accessible
- For Docker: make sure containers are running (`docker-compose ps`)

#### "Contract not found" Error
- Verify the ConfluxScan API URL is correct
- Check if the contract address is valid and verified on ConfluxScan
- Ensure network connectivity to ConfluxScan API

### Testing Configuration

```bash
# Test database connection
npm run db:studio

# Test API endpoints
curl http://localhost:3000/api/health

# Verify environment variables are loaded
npm run dev --verbose
```

## Security Best Practices

1. **Never commit `.env.local` or `.env` files**
2. **Use strong, random secrets for JWT and webhook keys**
3. **Rotate API keys regularly**
4. **Use environment-specific configurations**
5. **Monitor API key usage and set limits**
6. **Use HTTPS in production**
7. **Enable rate limiting**

## Getting Help

If you're having configuration issues:

1. Check the [README.md](README.md) for setup instructions
2. Verify your API keys are valid and active
3. Test database connectivity
4. Check the console for specific error messages
5. Review the logs for detailed error information

For additional support, please check the project documentation or create an issue.