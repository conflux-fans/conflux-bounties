# AI Smart Contract Auditor

A comprehensive AI-powered smart contract auditor with static analysis, webhook notifications, and advanced reporting capabilities.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (via Docker recommended)
- At least one AI API key (Anthropic Claude recommended)

### Installation

```bash
# Clone and setup
git clone <repository-url>
cd bounties/01-ai-smart-contract-auditor
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your API keys (see configuration below)

# Setup database (Docker recommended)
docker-compose up -d
npm run db:migrate

# Start application
npm run dev
```

Visit `http://localhost:3000` to use the auditor.

## ⚙️ Configuration

### Required Environment Variables

Edit `.env.local` with your values:

```env
# AI API Keys (You need AT LEAST ONE)
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here  # RECOMMENDED
OPENAI_API_KEY=sk-your-openai-key-here             # Alternative

# Conflux Network API
CONFLUXSCAN_API_URL=https://evmapi.confluxscan.org

# Database
DATABASE_URL="postgresql://postgres:mypassword123@localhost:5555/audit_db?schema=public"
```

### Getting API Keys

**Anthropic Claude (Recommended)**
- Superior code analysis and security auditing capabilities
- Get your key at [Anthropic Console](https://console.anthropic.com/)
- Create API key → Copy the `sk-ant-` key

**OpenAI (Alternative)**
- Get your key at [OpenAI Platform](https://platform.openai.com/account/api-keys)
- Create API key → Copy the `sk-` key

### Optional Configuration

```env
# Application Settings
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development

# Security (recommended for production)
JWT_SECRET=your-random-jwt-secret-256-bits-long
WEBHOOK_SECRET=your-webhook-hmac-secret-key

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

## 🐳 Docker Deployment

Complete production setup:

```bash
# Copy Docker environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Start all services
docker-compose up -d

# Services available:
# - Web app: http://localhost:3000
# - Database: localhost:5432
# - Redis: localhost:6379
```

## 🔧 Features

### Core Capabilities
- **AI-Powered Analysis**: Claude/GPT-4 integration for intelligent vulnerability detection
- **Static Analysis**: Integrated Slither and Mythril tools
- **Real-time Progress**: Live progress tracking during audits
- **Batch Processing**: CSV upload for multiple contract audits
- **Webhook Notifications**: Real-time audit completion notifications

### Technical Features
- **PostgreSQL + Prisma**: Production-ready database with migrations
- **Modern React UI**: Intuitive interface with custom styling
- **RESTful APIs**: Comprehensive API for integration
- **Docker Support**: Complete containerized deployment
- **Test Suite**: Jest tests with 80%+ coverage target

## 📚 API Usage

### Start an Audit
```bash
curl -X POST http://localhost:3000/api/audit/start \
  -H "Content-Type: application/json" \
  -d '{"address":"cfx:123456789abcdef"}'
```

### Check Progress
```bash
curl http://localhost:3000/api/audit/status/JOB_ID
```

### Get Report
```bash
curl http://localhost:3000/api/audit/report/JOB_ID
```

### Configure Webhooks
```bash
curl -X POST http://localhost:3000/api/webhook/configure \
  -H "Content-Type: application/json" \
  -H "X-User-ID: your-user-id" \
  -d '{
    "webhook_url": "https://your-server.com/webhook",
    "events": ["audit_completed", "audit_failed"]
  }'
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🏗️ Architecture

```
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── audit/         # Audit endpoints
│   │   ├── reports/       # Report management
│   │   └── webhook/       # Webhook configuration
│   ├── audit/report/      # Report viewer pages
│   └── page.tsx           # Main interface
├── lib/                   # Core Libraries
│   ├── analysisEngine.ts  # Main audit engine
│   ├── confluxScanClient.ts # Contract source fetching
│   ├── database.ts        # Database operations
│   └── webhooks.ts        # Webhook system
├── components/            # React Components
├── __tests__/            # Test Suite
└── docker-compose.yml    # Docker configuration
```

## 🔄 Audit Process

1. **Input Validation**: Verify contract address format
2. **Source Retrieval**: Fetch source code from ConfluxScan
3. **Static Analysis**: Run Slither/Mythril via Docker
4. **AI Analysis**: Claude/GPT-4 validates and enhances findings
5. **Report Generation**: Create JSON and Markdown reports
6. **Database Storage**: Save complete audit data
7. **Webhook Notifications**: Send completion notifications

## 🛡️ Security Features

- **HMAC Webhook Signatures**: Cryptographically signed payloads
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: Configurable API rate limits
- **Environment Isolation**: Docker container security
- **Secret Management**: Environment-based configuration

## 🚨 Troubleshooting

### Common Issues

**Missing API Key Error**
- Ensure you have at least one AI API key configured
- Verify the key format (`sk-ant-` for Anthropic, `sk-` for OpenAI)

**Database Connection Error**
- Check PostgreSQL is running: `docker-compose ps`
- Verify DATABASE_URL format is correct
- Run migrations: `npm run db:migrate`

**Contract Not Found**
- Verify contract address is valid and verified on ConfluxScan
- Check CONFLUXSCAN_API_URL is set correctly

### Testing Configuration
```bash
# Test database connection
npm run db:studio

# Test API health
curl http://localhost:3000/api/health

# Check logs
docker-compose logs -f web
```

## 📊 Database Commands

```bash
# Run migrations
npm run db:migrate

# Reset database
npm run db:reset

# View database
npm run db:studio

# Generate Prisma client
npm run db:generate
```

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

- **GitHub Issues**: Report bugs and request features
- **Documentation**: This README covers setup and usage
- **API Testing**: Use the curl examples above
- **Docker Issues**: Check `docker-compose logs -f web`

For additional help, please create an issue with detailed error messages and configuration details.