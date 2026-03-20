# Conflux Smart Contract Auditor

AI-powered smart contract security auditor for Conflux eSpace. Analyze verified contracts for vulnerabilities, gas issues, and code quality problems.

## Features

- 🔍 **Contract Analysis** - Fetch and analyze verified contracts via ConfluxScan API
- 🤖 **AI-Powered Detection** - LLM-based vulnerability detection with SWC/CWE classification
- 📊 **Structured Reports** - JSON and Markdown reports with severity scoring
- 🌐 **Web Interface** - Clean, responsive Next.js dashboard
- 📚 **Audit History** - Store and retrieve historical audit results
- 🔌 **REST API** - Programmatic access with batch support
- 🐳 **Docker Ready** - Full stack deployment with `docker compose up`

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Next.js    │───▶│  API Routes  │───▶│ ConfluxScan │
│  Frontend   │◀───│  (Backend)   │    │    API      │
└─────────────┘    └──────┬───────┘    └─────────────┘
                          │
                   ┌──────┴───────┐
                   ▼              ▼
              ┌─────────┐   ┌──────────┐
              │  OpenAI  │   │PostgreSQL│
              │   API    │   │  (Prisma)│
              └─────────┘   └──────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- OpenAI API key

### Setup

1. Clone and install:
```bash
cd submissions/zhaog100-01-auditor
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your API keys and database URL
```

3. Setup database:
```bash
npx prisma db push
npx prisma generate
```

4. Run development server:
```bash
npm run dev
```

### Docker (Recommended)

```bash
cp .env.example .env
# Edit .env with your OPENAI_API_KEY
docker compose up --build
```

The app will be available at http://localhost:3000

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/audit/start` | Start contract analysis |
| GET | `/api/audit/status/:jobId` | Check analysis status |
| GET | `/api/audit/report/:jobId` | Get audit report |
| POST | `/api/audit/batch` | Batch analysis |
| GET | `/api/contracts/:address` | Get contract info |
| GET | `/api/reports/:address/history` | Get audit history |
| POST | `/api/webhook/configure` | Configure webhooks |

### Example Usage

```bash
# Start an audit
curl -X POST http://localhost:3000/api/audit/start \
  -H "Content-Type: application/json" \
  -d '{"address": "0x...contract_address..."}'

# Check status
curl http://localhost:3000/api/audit/status/<jobId>

# Get report
curl http://localhost:3000/api/audit/report/<jobId>
```

### Report Format

```json
{
  "contract": {
    "address": "0x...",
    "name": "MyToken",
    "compiler": "v0.8.19"
  },
  "summary": {
    "totalFindings": 5,
    "criticalCount": 0,
    "highCount": 1,
    "mediumCount": 2,
    "lowCount": 2,
    "overallRisk": "medium"
  },
  "findings": [
    {
      "id": "F001",
      "category": "security",
      "severity": "high",
      "swc": "SWC-107",
      "cwe": "CWE-841",
      "title": "Reentrancy Vulnerability",
      "description": "...",
      "lines": [45, 46],
      "codeSnippet": "...",
      "recommendation": "Use checks-effects-interactions pattern"
    }
  ]
}
```

## SWC Coverage

| SWC | Description |
|-----|-------------|
| SWC-101 | Integer Overflow and Underflow |
| SWC-104 | Unchecked Call Return Values |
| SWC-105 | Unprotected Ether Withdrawal |
| SWC-107 | Reentrancy |
| SWC-108 | State Variable Default Visibility |
| SWC-109 | Uninitialized Storage Pointer |
| SWC-115 | Authorization through tx.origin |
| SWC-116 | Block values as proxy for time |
| SWC-119 | Shadowing State Variables |

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **AI**: OpenAI GPT-4o-mini
- **Blockchain**: ConfluxScan API, ethers.js
- **Deployment**: Docker, docker compose

## Testing

```bash
# Run tests with coverage
npm test

# Watch mode
npm run test:watch
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `CONFLUXSCAN_API_URL` | ConfluxScan API URL | No (default: confluxscan.io) |
| `CONFLUXSCAN_API_KEY` | ConfluxScan API key | No |
| `JWT_SECRET` | Session secret | No (auto-generated) |
| `MAX_CONTRACT_SIZE` | Max source code size | No (default: 1MB) |

## License

MIT
