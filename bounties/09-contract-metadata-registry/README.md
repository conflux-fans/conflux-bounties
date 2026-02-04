# Conflux Contract Metadata Registry

A verified metadata registry where Conflux projects upload ABI, source, logo, and descriptions for deployed contracts. Metadata lives on IPFS, and a web UI lets teams submit, update, and browse entries with validation rules.

## Features

- **Registry Contract**: UUPS upgradeable Solidity contract storing metadata records on-chain
- **Verification**: Ownership proof via wallet signature, bytecode hash verification
- **IPFS Integration**: Automatic pinning to Pinata with content hash verification
- **Web UI**: Submit metadata, browse contracts, admin moderation panel
- **SDK**: Lightweight TypeScript client for wallets/explorers

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
│  (Next.js)  │     │  (Fastify)  │     │   + Redis   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                    ┌─────▼─────┐
                    │   IPFS    │
                    │ (Pinata)  │
                    └───────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ and pnpm
- MetaMask wallet
- Pinata account (free tier works)

### 1. Clone and Setup

```bash
cd bounties/09-contract-metadata-registry

# Copy environment template
cp .env.example .env

# Edit .env with your values:
# - PINATA_JWT: Get from https://pinata.cloud
# - MODERATOR_ADDRESSES: Your wallet address
```

### 2. Start Services

```bash
# Start postgres, redis, backend
docker compose up --build

# In another terminal, start frontend
cd frontend
pnpm install
pnpm run dev
```

### 3. Access the App

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Health: http://localhost:3001/api/health

## Project Structure

```
├── contracts/          # Solidity smart contracts
│   ├── contracts/      # ContractMetadataRegistry.sol
│   ├── scripts/        # Deploy & upgrade scripts
│   └── test/           # Hardhat tests (41 passing)
│
├── backend/            # Fastify API server
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── services/   # IPFS, verification, webhook
│   │   ├── workers/    # BullMQ pin & verify workers
│   │   └── db/         # Drizzle ORM schema
│   └── __tests__/      # Jest tests (18 passing)
│
├── frontend/           # Next.js 16 app
│   ├── app/            # App router pages
│   ├── components/     # React components
│   └── lib/            # Web3 config, schemas
│
├── sdk/                # TypeScript SDK for integrations
│
└── docker-compose.yml  # Full stack deployment
```

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/contracts/:address` | Get approved metadata for contract |
| GET | `/api/contracts` | List/search contracts |
| GET | `/api/submissions/:id` | Check submission status |

### Authenticated Endpoints (require wallet signature)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submissions` | Submit new metadata |
| POST | `/api/admin/approve/:id` | Approve submission (moderator) |
| POST | `/api/admin/reject/:id` | Reject submission (moderator) |

### Example: Fetch Contract Metadata

```bash
curl http://localhost:3001/api/contracts/0x1234...
```

Response:
```json
{
  "id": 1,
  "contractAddress": "0x1234...",
  "metadataCid": "QmXyz...",
  "rawMetadata": {
    "name": "My Token",
    "description": "An ERC20 token",
    "abi": [...],
    "compiler": { "name": "solc", "version": "0.8.28" },
    "tags": ["ERC20", "Token"]
  },
  "status": "approved"
}
```

## SDK Usage

```typescript
import { RegistryClient } from '@conflux-registry/sdk';

const client = new RegistryClient('http://localhost:3001');

// Get contract metadata
const metadata = await client.getMetadata('0x1234...');
console.log(metadata.rawMetadata.name);

// Get just the ABI
const abi = await client.getABI('0x1234...');

// Search by tag
const tokens = await client.search({ tag: 'ERC20' });
```

## Smart Contract

The registry contract (`ContractMetadataRegistry.sol`) stores:

- Contract address → Metadata record mapping
- Owner, CID, content hash, version, status
- Delegate permissions for multi-user management

### Deploy to Conflux eSpace Testnet

```bash
cd contracts
cp .env.example .env
# Add PRIVATE_KEY to .env

npx hardhat run scripts/deploy.ts --network confluxESpaceTestnet
```

### Contract Functions

| Function | Description |
|----------|-------------|
| `submitMetadata(address, cid, hash)` | Submit metadata (owner only) |
| `approve(address)` | Approve pending metadata (moderator) |
| `reject(address, reason)` | Reject with reason (moderator) |
| `getRecord(address)` | View metadata record |
| `setDelegate(address, delegate, bool)` | Allow delegate to submit |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `CONFLUX_RPC_URL` | Conflux eSpace RPC endpoint | Yes |
| `REGISTRY_ADDRESS` | Deployed contract address | Yes |
| `PINATA_JWT` | Pinata API JWT token | Yes |
| `MODERATOR_ADDRESSES` | Comma-separated moderator wallets | Yes |
| `WEBHOOK_URL` | Optional webhook for approvals | No |

## Testing

### Smart Contracts

```bash
cd contracts
pnpm install
pnpm test  # 41 tests
```

### Backend

```bash
cd backend
pnpm install
pnpm test  # 18 tests
```

## User Flow

1. **Connect Wallet**: User connects MetaMask on Conflux eSpace
2. **Submit Metadata**: Fill form with contract address, name, ABI, tags
3. **IPFS Pinning**: Backend validates, pins to Pinata, computes hash
4. **Moderation**: Admin reviews and approves/rejects
5. **Discovery**: Approved contracts appear in registry search
6. **Integration**: Wallets/explorers fetch metadata via API or SDK

## License

MIT

