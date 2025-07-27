# AI Smart Contract Auditor

A comprehensive AI-powered smart contract auditor with static analysis, webhook notifications, and advanced reporting capabilities.

## 🚀 Features

### Core Analysis
- **AI-Powered Analysis**: OpenAI GPT-4 and Anthropic Claude integration for intelligent vulnerability detection
- **Static Analysis**: Integrated Slither and Mythril tools for comprehensive code analysis
- **Multi-Tool Validation**: AI validates and enhances static analysis findings
- **Real-time Progress**: Live progress tracking with detailed stage information

### User Interface
- **Modern React UI**: Intuitive interface with Tailwind CSS styling
- **Batch Processing**: CSV upload for multiple contract audits
- **Audit History**: Complete audit history with search and filtering
- **Report Viewer**: Interactive report display with multiple formats

### Data & Storage
- **Local SQLite Database**: Automatic local persistence for audit reports
- **Audit History API**: RESTful endpoints for accessing historical audit data
- **Report Export**: JSON and Markdown format downloads
- **No External Dependencies**: Fully self-contained storage

### Notifications & Webhooks
- **Webhook System**: Real-time notifications for audit completion/failure
- **HMAC Security**: Secure webhook delivery with signature verification
- **Retry Logic**: Automatic retry with exponential backoff
- **Custom Headers**: Configurable webhook headers and timeouts

### Infrastructure
- **Standalone Application**: Runs with just `npm run dev`
- **Optional Docker**: Docker deployment available for production
- **Local First**: No external services required

### Testing & Quality
- **Comprehensive Tests**: Jest test suite with 80%+ coverage target
- **API Testing**: Complete API endpoint testing
- **Mock LLM Testing**: Simulated AI responses for reliable testing

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Local Installation (Standalone)

```bash
# Clone the repository
git clone <repository-url>
cd bounties/01-ai-smart-contract-auditor

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your API keys (see below)

# Run in development mode
npm run dev
```

The application will be available at `http://localhost:3000`

### Environment Variables

Create `.env.local` with the following configuration:

```env
# Required: AI API Keys (at least one)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Required: Conflux Network
CONFLUX_SCAN_API_KEY=your-conflux-scan-api-key

# Application
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development

# Optional: Security
JWT_SECRET=your-random-jwt-secret
WEBHOOK_SECRET=your-webhook-secret-key
```

### Local Database

The application uses JSON file storage for local persistence:
- Database file: `./data/database.json` (created automatically)
- No additional setup required
- All audit reports and webhooks are stored locally
- Human-readable JSON format for easy debugging

## 🐳 Docker Deployment

See [README-Docker.md](README-Docker.md) for complete Docker deployment guide.

### Quick Start

```bash
# Copy Docker environment file
cp .env.docker .env.local
# Edit .env.local with your API keys

# Start all services (web, db, redis, vector-db)
docker-compose up -d

# View logs
docker-compose logs -f web

# Access application
# Web: http://localhost:3000
# DB: localhost:5432
# Redis: localhost:6379
# Vector DB: localhost:5433
```

### Production Deployment

```bash
# Start with Nginx proxy and SSL
docker-compose --profile production up -d

# Scale web service
docker-compose up -d --scale web=2
```

### Available Services

- **web**: Next.js application (port 3000)
- **db**: PostgreSQL database (port 5432)
- **redis**: Redis cache (port 6379)
- **vector-db**: pgvector database (port 5433)
- **analysis-tools**: Mythril/Slither container
- **nginx**: Reverse proxy (ports 80/443) - production profile

## 📚 API Reference

### Core Audit APIs

#### 1. Start Audit
```bash
POST /api/audit/start
Content-Type: application/json

{
  "address": "cfx:123456789abcdef" // or "0x123456789abcdef"
}
```

**Response:**
```json
{
  "jobId": "uuid-v4-job-id",
  "status": "started",
  "message": "Audit started successfully"
}
```

#### 2. Check Audit Status
```bash
GET /api/audit/status/{jobId}
```

**Response:**
```json
{
  "id": "uuid-v4-job-id",
  "address": "cfx:123456789abcdef",
  "status": "processing", // pending | processing | completed | failed
  "progress": 75,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "findings": [], // when completed
  "reports": {}, // when completed
  "errorMessage": "..." // when failed
}
```

#### 3. Get Audit Report
```bash
GET /api/audit/report/{jobId}
```

**Response:**
```json
{
  "json": {
    "findings": [
      {
        "id": "finding-1",
        "category": "Access Control",
        "severity": "high",
        "swc_id": "SWC-105",
        "cwe_id": "CWE-284",
        "title": "Missing Access Control",
        "description": "Function lacks proper access control",
        "lines": [10, 11],
        "recommendation": "Add onlyOwner modifier"
      }
    ],
    "summary": {
      "totalFindings": 1,
      "severityCounts": {
        "critical": 0,
        "high": 1,
        "medium": 0,
        "low": 0
      },
      "contractAddress": "cfx:123456789abcdef",
      "analysisDate": "2024-01-01T00:00:00.000Z",
      "toolsUsed": ["AI Analysis", "Slither", "Mythril"]
    }
  },
  "markdown": "# Smart Contract Audit Report..."
}
```

### Audit History APIs

#### 4. Get Audit History by Address
```bash
GET /api/reports/{address}/history?limit=50&offset=0&status=completed
```

**Response:**
```json
{
  "success": true,
  "reports": [...],
  "pagination": {
    "total": 100,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "stats": {
    "total": 100,
    "completed": 95,
    "failed": 5,
    "avgFindings": 3.2
  }
}
```

#### 5. Get All Reports
```bash
GET /api/reports?sort=created_at&order=desc&limit=20
```

#### 6. Get Single Report
```bash
GET /api/reports/{reportId}?format=json // or markdown
```

### Webhook APIs

#### 7. Configure Webhook
```bash
POST /api/webhook/configure
Content-Type: application/json
X-User-ID: your-user-id

{
  "webhook_url": "https://your-server.com/webhook",
  "events": ["audit_completed", "audit_failed"],
  "secret_hmac": "optional-secret-key",
  "retry_count": 3,
  "timeout_seconds": 30,
  "custom_headers": {
    "Authorization": "Bearer your-token"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook configuration created successfully",
  "webhook": {
    "id": "webhook-id",
    "webhook_url": "https://your-server.com/webhook",
    "events": ["audit_completed", "audit_failed"],
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "secret_hmac": "generated-or-provided-secret"
}
```

#### 8. List Webhooks
```bash
GET /api/webhook/configure
X-User-ID: your-user-id
```

#### 9. Delete Webhook
```bash
DELETE /api/webhook/configure?id=webhook-id
X-User-ID: your-user-id
```

### Contract Source API

#### 10. Get Contract Source
```bash
GET /api/contracts/{address}
```

**Response:**
```json
{
  "address": "cfx:123456789abcdef",
  "source": "pragma solidity ^0.8.0; contract Test { ... }",
  "contractName": "Test",
  "compiler": "0.8.19"
}
```

### Webhook Payload Format

When audits complete, webhooks receive:

```json
{
  "event": "audit_completed", // or "audit_failed", "audit_started"
  "audit_id": "report-id",
  "contract_address": "cfx:123456789abcdef",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "status": "completed",
    "findings_count": 5,
    "severity_breakdown": {
      "critical": 1,
      "high": 2,
      "medium": 1,
      "low": 1
    },
    "processing_time_ms": 45000,
    "report_url": "https://your-app.com/audit/report/report-id"
  }
}
```

### Error Responses

All APIs return consistent error format:
```json
{
  "error": "Error message",
  "details": "Additional context",
  "type": "error_type",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

Common HTTP status codes:
- `400`: Bad Request (invalid input)
- `404`: Resource not found
- `429`: Rate limit exceeded
- `500`: Internal server error

## 🧪 Testing

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test confluxScanClient.test.ts

# Generate coverage report
npm run test:coverage

# Run tests with verbose output
npm test -- --verbose
```

### Test Coverage

The test suite targets 80%+ coverage and includes:

- **Unit Tests**: Core library functions (confluxScanClient, analysisEngine, staticAnalyzer)
- **API Tests**: All REST endpoints with mocked dependencies
- **Integration Tests**: End-to-end audit workflows
- **Mock Testing**: AI API responses and external service calls

### Test Files

```
__tests__/
├── lib/
│   ├── confluxScanClient.test.ts   # ConfluxScan API tests
│   ├── staticAnalyzer.test.ts      # Static analysis tests
│   └── analysisEngine.test.ts      # Core audit engine tests
├── api/
│   ├── audit/
│   │   ├── start.test.ts           # Audit start endpoint
│   │   └── status.test.ts          # Audit status endpoint
│   └── webhook/
│       └── configure.test.ts       # Webhook configuration tests
└── reportGenerator.test.ts         # Report generation tests
```

## 🏗️ Architecture

### Project Structure

```
├── app/                            # Next.js App Router
│   ├── api/                        # API Routes
│   │   ├── audit/
│   │   │   ├── start/route.ts      # Start audit
│   │   │   ├── status/[jobId]/route.ts # Audit status
│   │   │   └── report/[jobId]/route.ts # Get audit report
│   │   ├── reports/
│   │   │   ├── route.ts            # List all reports
│   │   │   ├── [id]/route.ts       # Get single report
│   │   │   └── [address]/history/route.ts # Address history
│   │   ├── webhook/
│   │   │   └── configure/route.ts  # Webhook management
│   │   ├── contracts/[address]/route.ts # Contract source
│   │   └── health/route.ts         # Health check
│   ├── audit/
│   │   └── report/[jobId]/page.tsx # Report viewer page
│   ├── history/
│   │   └── page.tsx                # Audit history page
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # Main audit interface
├── lib/                            # Core Libraries
│   ├── analysisEngine.ts           # AI + Static analysis engine
│   ├── confluxScanClient.ts        # ConfluxScan API client
│   ├── staticAnalyzer.ts           # Slither/Mythril integration
│   ├── reportGenerator.ts          # Report formatting
│   ├── supabase.ts                 # Database operations
│   └── webhooks.ts                 # Webhook delivery system
├── components/                     # React Components
│   ├── AuditForm.tsx              # Main audit form
│   ├── BatchAuditMode.tsx         # CSV upload interface
│   ├── AuditProgress.tsx          # Progress tracking
│   └── ReportViewer.tsx           # Report display
├── __tests__/                      # Test Suite
├── docker/                         # Docker Configuration
│   ├── nginx.conf                  # Nginx configuration
│   └── vector-db-init.sql         # Vector DB schema
├── docs/                          # Documentation
│   └── WEBHOOKS.md                # Webhook documentation
├── Dockerfile                      # Container definition
├── docker-compose.yml              # Multi-service orchestration
├── supabase-schema.sql             # Database schema
└── README-Docker.md               # Docker deployment guide
```

### Core Components

#### Analysis Engine (`lib/analysisEngine.ts`)
- Orchestrates the complete audit pipeline
- Integrates static analysis tools with AI validation
- Provides real-time progress tracking via EventEmitter
- Saves results to Supabase and triggers webhooks

#### Static Analyzer (`lib/staticAnalyzer.ts`)
- Docker-based Slither and Mythril integration
- Parses tool outputs and normalizes findings
- Handles tool failures gracefully

#### Webhook System (`lib/webhooks.ts`)
- HMAC-secured webhook delivery
- Configurable retry logic with exponential backoff
- Support for custom headers and timeouts
- Comprehensive delivery tracking

#### Database Layer (`lib/supabase.ts`)
- Complete CRUD operations for audit reports
- Webhook configuration management
- Audit statistics and analytics
- Type-safe database operations

## 🔄 Audit Workflow

### Complete Audit Pipeline

1. **Input Validation**: Contract address format verification
2. **Source Retrieval**: Fetch source code from ConfluxScan API
3. **Static Analysis**: Run Slither and Mythril via Docker
4. **AI Analysis**: 
   - Send source + static findings to OpenAI/Anthropic
   - AI validates static findings and finds additional issues
   - Parse and normalize AI response
5. **Report Generation**: Create JSON and Markdown reports
6. **Database Storage**: Save complete audit data to Supabase
7. **Webhook Notifications**: Send completion/failure notifications
8. **Progress Tracking**: Real-time updates via EventEmitter

### Audit Statuses

- `pending`: Audit queued for processing
- `processing`: Analysis in progress (with progress percentage)
- `completed`: Audit finished successfully with results
- `failed`: Audit failed with error message

### Finding Categories

The system detects vulnerabilities across categories:
- **Access Control**: Missing modifiers, unauthorized access
- **Reentrancy**: State changes after external calls
- **Integer Issues**: Overflow/underflow vulnerabilities
- **External Calls**: Unchecked return values
- **Gas Issues**: DoS via gas limit, expensive operations
- **Logic Errors**: Business logic flaws
- **Best Practices**: Code quality and optimization

### AI Integration

The system supports multiple AI providers:
- **OpenAI**: GPT-4 with 4000 token responses
- **Anthropic**: Claude Haiku with structured analysis
- **Fallback Logic**: Automatic failover between providers
- **Validation**: AI validates and enhances static analysis findings

## 🚀 Quick Start Examples

### Basic Audit
```bash
# Start an audit
curl -X POST http://localhost:3000/api/audit/start \
  -H "Content-Type: application/json" \
  -d '{"address":"cfx:123456789abcdef"}'

# Check progress  
curl http://localhost:3000/api/audit/status/RETURNED_JOB_ID

# Get report when complete
curl http://localhost:3000/api/audit/report/RETURNED_JOB_ID
```

### Webhook Setup
```bash
# Configure webhook notifications
curl -X POST http://localhost:3000/api/webhook/configure \
  -H "Content-Type: application/json" \
  -H "X-User-ID: my-user" \
  -d '{
    "webhook_url": "https://my-server.com/webhooks",
    "events": ["audit_completed", "audit_failed"],
    "retry_count": 3
  }'
```

### Docker Deployment
```bash
# Complete deployment with all services
git clone <repo>
cd bounties/01-ai-smart-contract-auditor
cp .env.docker .env.local
# Edit .env.local with your API keys
docker-compose up -d
```

## 📊 Features Overview

| Feature | Status | Description |
|---------|--------|-------------|
| ✅ AI Analysis | Complete | OpenAI GPT-4 & Anthropic Claude integration |
| ✅ Static Analysis | Complete | Slither & Mythril Docker integration |
| ✅ Real-time Progress | Complete | EventEmitter-based progress tracking |
| ✅ Supabase Storage | Complete | Complete audit history persistence |
| ✅ Webhook System | Complete | HMAC-secured notifications with retry |
| ✅ Batch Processing | Complete | CSV upload for multiple contracts |
| ✅ Report Export | Complete | JSON & Markdown format downloads |
| ✅ Docker Deployment | Complete | Multi-service production setup |
| ✅ Test Suite | Complete | 80%+ coverage with Jest |
| ✅ API Documentation | Complete | RESTful endpoints with examples |

## 🔧 Configuration

### Required Environment Variables
```env
# At least one AI provider required
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Required for Conflux network
CONFLUX_SCAN_API_KEY=your-key
```

### Optional Features
```env
# Application settings
NEXT_PUBLIC_BASE_URL=http://localhost:3000
NODE_ENV=development

# Security (optional)
JWT_SECRET=your-random-secret
WEBHOOK_SECRET=your-webhook-secret
```

## 🛡️ Security Features

- **HMAC Webhook Signatures**: Cryptographically signed webhook payloads
- **Input Validation**: Comprehensive request validation and sanitization  
- **Rate Limiting**: Nginx-based API rate limiting (configurable)
- **Environment Isolation**: Docker container isolation
- **Secret Management**: Environment-based secret configuration
- **HTTPS Enforcement**: SSL/TLS configuration for production

## 🎥 Demo

### Live Demo
> **Coming Soon**: Public demo deployment

### Video Walkthrough
> **Coming Soon**: Feature demonstration video

### Screenshots
> **Coming Soon**: UI screenshots and workflow examples

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Install dependencies (`npm install`)
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Maintain 80%+ test coverage
- Use conventional commit messages
- Update documentation for new features
- Test Docker deployment locally

## 📚 Documentation

- **[README-Docker.md](README-Docker.md)**: Complete Docker deployment guide
- **[docs/WEBHOOKS.md](docs/WEBHOOKS.md)**: Webhook configuration and usage
- **[supabase-schema.sql](supabase-schema.sql)**: Database schema and setup
- **API Reference**: Comprehensive API documentation above

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- Check this README for setup instructions
- Review [Docker deployment guide](README-Docker.md)
- Read [webhook documentation](docs/WEBHOOKS.md)

### Troubleshooting
```bash
# Check application logs
docker-compose logs -f web

# Verify database connection
docker-compose exec web npm run db:test

# Test API endpoints
curl http://localhost:3000/api/health
```

### Issues & Questions
- **GitHub Issues**: Report bugs and request features
- **API Issues**: Check endpoint documentation and examples
- **Docker Issues**: Review Docker logs and environment variables
- **Database Issues**: Verify Supabase configuration and schema

### Performance Optimization
- Enable Redis caching for improved response times
- Use Nginx proxy for production deployments  
- Configure database connection pooling
- Monitor webhook delivery success rates