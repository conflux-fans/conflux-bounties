# Conflux Automation Site

Non-custodial limit orders and DCA strategies on Conflux eSpace.

🏆 **Bounty #08: Conflux Automation Site - $1,000**

## 🎯 Overview

This project delivers a complete MVP for creating and executing non-custodial limit-order and DCA strategies on Conflux eSpace. The system consists of:

- **Smart Contracts**: Solidity contracts for job management and price oracles
- **Backend API**: Fastify-based REST API for job CRUD operations
- **Worker Service**: Automated job execution with price monitoring
- **Frontend Dashboard**: Next.js web app with wallet integration

## ✨ Features

✅ **Non-custodial**: Users approve contracts per strategy - no fund custody
✅ **Limit Orders**: Execute when price reaches target within slippage
✅ **DCA Strategies**: Recurring buys/sells on configurable intervals
✅ **Safety Controls**: Global pause, per-job cancel, audit logs
✅ **Real-time Updates**: WebSocket support for live execution tracking
✅ **Wallet Connect**: wagmi integration for Conflux eSpace

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│                  Wallet Connect + Dashboard              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  Backend API (Fastify)                   │
│            Job CRUD + Auth + WebSocket                   │
└──────────┬───────────────────────┬──────────────────────┘
           │                       │
┌──────────▼──────────┐  ┌────────▼────────────┐
│   SQLite Database   │  │   Worker Service    │
│   Jobs + Executions │  │   Price Monitoring  │
└─────────────────────┘  └────────┬────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │  Smart Contracts (Solidity)│
                    │  JobManager + PriceOracle  │
                    └───────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Docker & Docker Compose (optional)

### 1. Clone Repository

```bash
git clone https://github.com/ryan-the-zilla/conflux-bounties.git
cd bounties/08-conflux-automation-site
```

### 2. Install Dependencies

```bash
# Contracts
cd contracts && npm install

# Backend
cd ../backend && npm install

# Worker
cd ../worker && npm install

# Frontend
cd ../frontend && npm install
```

### 3. Deploy Smart Contracts

```bash
cd contracts

# Configure environment
cp .env.example .env
# Edit .env with your PRIVATE_KEY and CONFLUX_RPC_URL

# Compile
npm run compile

# Deploy to testnet
npm run deploy:testnet

# Note the deployed addresses
```

### 4. Start Backend

```bash
cd backend

# Configure environment
cp .env.example .env
# Add deployed contract addresses

# Start server
npm run dev
```

### 5. Start Worker

```bash
cd worker

# Configure environment
cp .env.example .env
# Add PRIVATE_KEY_EXECUTOR and contract addresses

# Start worker
npm run dev
```

### 6. Start Frontend

```bash
cd frontend

# Configure environment
cp .env.example .env
# Add API URL and contract addresses

# Start dev server
npm run dev
```

Visit `http://localhost:3000`

## 🐳 Docker Deployment

```bash
# Create .env file with all variables
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📝 Environment Variables

### Backend (.env)

```bash
PORT=3001
JWT_SECRET=your-secret-key
DATABASE_URL=/app/data/automation.db
CONFLUX_RPC_URL=https://test.confluxrpc.com
JOB_MANAGER_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...
```

### Worker (.env)

```bash
CONFLUX_RPC_URL=https://test.confluxrpc.com
PRIVATE_KEY_EXECUTOR=0x...
JOB_MANAGER_ADDRESS=0x...
PRICE_ORACLE_ADDRESS=0x...
DATABASE_URL=/app/data/automation.db
POLL_INTERVAL=*/30 * * * * *
```

### Frontend (.env)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CONFLUX_CHAIN_ID=71
NEXT_PUBLIC_JOB_MANAGER_ADDRESS=0x...
```

## 🧪 Testing

### Smart Contracts

```bash
cd contracts
npm test
```

### Backend API

```bash
cd backend
npm test
```

## 📚 API Documentation

### Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

Get token by signing a message via `/api/auth/verify`

### Endpoints

#### Jobs

- `GET /api/jobs` - Get all user jobs
- `POST /api/jobs` - Create new job
- `GET /api/jobs/:id` - Get job details
- `PATCH /api/jobs/:id/status` - Update job status
- `DELETE /api/jobs/:id` - Cancel job

#### Executions

- `GET /api/executions` - Get all user executions
- `GET /api/jobs/:id/executions` - Get job executions

#### Other

- `GET /api/health` - Health check
- `GET /api/tokens` - Supported tokens
- `POST /api/auth/verify` - Wallet signature verification
- `GET /api/admin/audit-logs` - Audit logs (admin)

## 🔒 Security Features

- **Non-custodial**: Contracts never hold user funds
- **Per-job approvals**: Explicit token allowances per strategy
- **Permit support**: EIP-2612 permit signatures
- **Global pause**: Emergency circuit breaker
- **Rate limiting**: Max slippage protection (50% cap)
- **Audit logging**: All actions logged

## 🎨 User Flow

1. **Connect Wallet** - Sign message to authenticate
2. **Create Strategy** - Configure limit order or DCA
3. **Approve Tokens** - One-time approval per token
4. **Activate Job** - Job stored on-chain + in database
5. **Monitor Execution** - Worker executes when conditions met
6. **Track History** - View all executions in dashboard
7. **Manage Jobs** - Pause, resume, or cancel anytime

## 🛠️ Tech Stack

**Smart Contracts**
- Solidity 0.8.20
- OpenZeppelin Contracts 5.0
- Hardhat

**Backend**
- Node.js 20
- Fastify 4
- Better-SQLite3
- Ethers.js 6

**Frontend**
- Next.js 14
- React 18
- wagmi + viem
- Tailwind CSS

**Infrastructure**
- Docker
- Docker Compose

## 📖 Documentation

- [Architecture Diagram](./docs/architecture.md)
- [Smart Contract Specs](./docs/contracts.md)
- [API Reference](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)

## 🤝 Contributing

This is a bounty submission. For improvements or issues, please open a PR or issue in the main repository.

## 📄 License

MIT

## 🙏 Acknowledgments

- Conflux Network
- OpenZeppelin
- wagmi team

---

**Wallet for bounty**: `AqE264DnKyJci9kV4t3eYhDtFB3H88HQusWtH5odSqHM`

⚠️ **Experimental Software**: This is an exploratory MVP. Use at your own risk. Not production-ready.
