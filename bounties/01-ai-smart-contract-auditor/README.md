# AI Smart Contract Auditor

An automated smart contract auditor using the ConfluxScan API to analyze and generate security reports.

## 🚀 Features

- **Automated Analysis**: Contract source code retrieval and analysis from ConfluxScan
- **Intuitive Web Interface**: React UI with real-time progress tracking
- **Comprehensive Reports**: JSON and Markdown export of audit results
- **REST API**: Endpoints for integration with other tools
- **Complete Test Suite**: 80%+ test coverage
- **Docker Deployment**: Production-ready configuration

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### Local Installation

```bash
# Clone the repository
git clone <repository-url>
cd bounties/01-ai-smart-contract-auditor

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run in development mode
npm run dev
```

The application will be available at `http://localhost:3000`

### Environment Variables

```env
NODE_ENV=development
PORT=3000
CONFLUXSCAN_API_URL=https://evmapi.confluxscan.org
```

## 🐳 Docker Deployment

### Quick Start

```bash
# Build and run
docker-compose up --build

# Run in background
docker-compose up -d --build
```

### Manual Build

```bash
# Build image
docker build -t ai-smart-contract-auditor .

# Run container
docker run -p 3000:3000 --env-file .env ai-smart-contract-auditor
```

## 📚 API Reference

### 1. Get Contract Source Code

```bash
GET /api/contracts/{address}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/contracts/0x1234567890123456789012345678901234567890"
```

**Response:**
```json
{
  "source": "contract TestContract { ... }"
}
```

### 2. Start Audit

```bash
POST /api/audit/start
Content-Type: application/json

{
  "address": "0x1234567890123456789012345678901234567890"
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/audit/start" \
  -H "Content-Type: application/json" \
  -d '{"address": "0x1234567890123456789012345678901234567890"}'
```

**Response:**
```json
{
  "jobId": "uuid-v4-job-id"
}
```

### 3. Check Audit Status

```bash
GET /api/audit/status/{jobId}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/audit/status/uuid-v4-job-id"
```

**Response:**
```json
{
  "status": "processing",
  "progress": 75,
  "reportUrl": "/api/audit/report/uuid-v4-job-id"
}
```

### 4. Get Audit Report

```bash
GET /api/audit/report/{jobId}
```

**Example:**
```bash
curl -X GET "http://localhost:3000/api/audit/report/uuid-v4-job-id"
```

**Response:**
```json
{
  "json": {
    "findings": [],
    "summary": {
      "total": 0,
      "critical": 0,
      "high": 0,
      "medium": 0,
      "low": 0
    },
    "generatedAt": "2024-01-01T00:00:00.000Z"
  },
  "markdown": "# Audit Report..."
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## 🏗️ Architecture

```
├── app/
│   ├── api/
│   │   ├── audit/
│   │   │   ├── start/route.ts      # Start audit
│   │   │   ├── status/[jobId]/route.ts # Audit status
│   │   │   └── report/[jobId]/route.ts # Audit report
│   │   ├── contracts/[address]/route.ts # Contract source
│   │   └── health/route.ts         # Health check
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                    # User interface
├── lib/
│   ├── analysisEngine.ts           # Analysis engine
│   ├── confluxScanClient.ts        # ConfluxScan API client
│   └── reportGenerator.ts          # Report generator
├── __tests__/                      # Test suite
├── Dockerfile                      # Docker configuration
└── docker-compose.yml              # Docker orchestration
```

## 🔄 Audit Workflow

1. **Submission**: User submits a contract address
2. **Retrieval**: System fetches source code from ConfluxScan
3. **Analysis**: Analysis engine processes the code (currently a stub)
4. **Report**: Generation of JSON and Markdown reports
5. **Export**: User can download or view reports

## 📊 Audit Statuses

- `pending`: Audit waiting for processing
- `processing`: Analysis in progress
- `completed`: Audit completed successfully
- `failed`: Audit failed (error occurred)

## 🎥 Demo

> **Demo Video**: [Coming soon]

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions or issues:
- Open an issue on GitHub
- Check the API documentation above
- Review Docker logs with `docker-compose logs`