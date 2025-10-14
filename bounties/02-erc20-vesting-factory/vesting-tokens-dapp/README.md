# VestingDApp - Token Vesting Factory Platform

A comprehensive blockchain platform for deploying ERC20 tokens with built-in vesting mechanisms. Deploy tokens and configure vesting schedules in a single transaction with support for team allocations, investor distributions, and community rewards.

## 🚀 Features

- **Single Transaction Deployment**: Deploy ERC20 token and vesting contracts together
- **Flexible Vesting Schedules**: Support for cliff, linear, and combined vesting
- **Multi-Beneficiary Support**: Handle multiple investors with different schedules
- **Batch Operations**: Deploy multiple projects and import beneficiaries via CSV
- **Real-time Analytics**: Track vesting progress and token distribution
- **User-friendly Interface**: Intuitive dashboard for deployment and management
- **Gas Optimized**: Uses minimal proxy patterns for efficient deployments

## 🛠 Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL), Drizzle ORM
- **Blockchain**: Ethereum Sepolia, Wagmi, RainbowKit
- **File Processing**: PapaParse for CSV handling

## 🧪 Testing

The project includes a comprehensive testing setup with Jest and React Testing Library.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

Current test coverage focuses on:
- **Utility Functions**: 100% coverage
- **State Management**: 71.69% coverage (stores)
- **Custom Hooks**: 12.1% coverage
- **UI Components**: 2.82% coverage

### Test Structure

- `src/lib/utils.test.ts` - Utility function tests
- `src/store/*.test.ts` - Zustand store tests
- `src/lib/hooks/*.test.ts` - Custom hook tests
- `src/components/ui/*.test.tsx` - UI component tests

For detailed testing information, see [TESTING.md](./TESTING.md).

## 🐳 Docker

The project includes comprehensive Docker support for development and production environments.

### Quick Start with Docker

```bash
# Start development environment
make start

# Or manually with docker-compose
docker-compose -f docker-compose.dev.yml up -d

# View logs
make dev-logs

# Stop services
make stop
```

### Docker Features

- **Multi-stage builds** for optimized production images
- **Hot reloading** in development environment
- **PostgreSQL database** with pgAdmin management
- **Redis caching** for improved performance
- **Health checks** and service dependencies
- **Volume mounting** for development workflow

### Docker Commands

```bash
# Development
make dev          # Start development environment
make dev-build    # Build and start development
make dev-logs     # View development logs
make dev-stop     # Stop development environment

# Production
make prod         # Start production environment
make prod-build   # Build and start production
make prod-logs    # View production logs

# Database
make migrate      # Run database migrations
make db-admin     # Start pgAdmin

# Testing
make test         # Run tests in Docker
make test-cov     # Run tests with coverage

# Utilities
make build        # Build Docker images
make clean        # Clean up Docker resources
make status       # Check service status
```

For detailed Docker information, see [DOCKER.md](./DOCKER.md).

## ⚡ Quick Deploy & Start (Alternative Method)

For developers who want to quickly deploy the contract and start the application in one command, we provide an automated deployment script.

### One-Command Deployment

```bash
# Make the script executable (first time only)
chmod +x deploy-and-start.sh

# Run the automated deployment and startup
./deploy-and-start.sh
```

### What the Script Does

The `deploy-and-start.sh` script automates the entire process:

1. **🚀 Contract Deployment**: Navigates to `contracts/hardhat-project` and deploys to Sepolia
2. **⚙️ Environment Setup**: Automatically extracts the contract address and updates `.env`
3. **▶️ Service Startup**: Starts the application using `make start`
4. **✅ Verification**: Checks if services are running properly

### Prerequisites for Quick Deploy

Before running the script, ensure you have:

- **Hardhat Configuration**: `.env` file in `contracts/hardhat-project/` with:
  ```env
  PRIVATE_KEY=your_private_key
  SEPOLIA_RPC_URL=your_sepolia_rpc_url
  ETHERSCAN_API_KEY=your_etherscan_key  # Optional
  ```
- **Sufficient Sepolia ETH** for contract deployment
- **Make** installed on your system

### Benefits of Quick Deploy

- **⏱️ Time Saving**: Deploy and start in one command
- **🔄 Automated**: No manual environment variable updates
- **✅ Error Handling**: Built-in validation and error checking
- **🎯 Focus**: Concentrate on development, not deployment setup

### Manual Alternative

If you prefer the traditional approach, follow the [Installation & Setup](#-installation--setup) section below.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18.17.0 or higher
- npm or yarn package manager
- Git
- A crypto wallet (MetaMask recommended)
- Alchemy API key
- WalletConnect Project ID

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd project_name
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file with the following variables:

```env
# Blockchain Configuration
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="your_wallet_connect_project_id"
NEXT_PUBLIC_ALCHEMY_API_KEY="your_alchemy_api_key"
NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS="0x1121C77E3AcC2281982AD91c53702A71E56d6Cd2"
NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS="XXXX"


# Supabase Configuration
DATABASE_URL="your_supabase_database_url"
```

### 4. Database Setup

Initialize the database schema using Drizzle:

```bash
# Generate database migrations
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Optional: Open database studio
npm run db:studio
```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## 📊 Database Schema

### Core Tables

#### users

Stores information about users:

| Column       | Type           | Description                                        |
| ------------ | -------------- | -------------------------------------------------- |
| `id`         | `UUID`         | Primary key, unique identifier for the user.       |
| `address`    | `VARCHAR(42)`  | User's unique wallet address. Cannot be null.      |
| `name`       | `VARCHAR(100)` | User's display name (optional).                    |
| `email`      | `VARCHAR(255)` | User's email address (optional).                   |
| `avatar`     | `VARCHAR(500)` | URL to the user's avatar image (optional).         |
| `created_at` | `TIMESTAMP`    | Timestamp of when the user was created.            |
| `updated_at` | `TIMESTAMP`    | Timestamp of the last update to the user's record. |

#### deployed_tokens

Stores information about deployed ERC20 tokens:

| Column            | Type           | Description                                                                |
| ----------------- | -------------- | -------------------------------------------------------------------------- |
| `id`              | `UUID`         | Primary key, unique identifier for the token deployment.                   |
| `address`         | `VARCHAR(42)`  | The unique contract address of the deployed token. Cannot be null.         |
| `name`            | `VARCHAR(100)` | The name of the token (e.g., "MyToken"). Cannot be null.                   |
| `symbol`          | `VARCHAR(20)`  | The symbol of the token (e.g., "MTK"). Cannot be null.                     |
| `total_supply`    | `VARCHAR(78)`  | The total supply of the token, stored as a string to handle large numbers. |
| `owner_address`   | `VARCHAR(42)`  | The wallet address of the user who deployed the token. Cannot be null.     |
| `factory_tx_hash` | `VARCHAR(66)`  | The transaction hash from the factory contract deployment. Cannot be null. |
| `deployed_at`     | `TIMESTAMP`    | Timestamp of when the token was deployed.                                  |

#### vesting_schedules

Manages vesting configurations for beneficiaries:

| Column                | Type          | Description                                                               |
| --------------------- | ------------- | ------------------------------------------------------------------------- |
| `id`                  | `UUID`        | Primary key, unique identifier for the schedule.                          |
| `token_id`            | `UUID`        | Foreign key referencing the deployed token.                               |
| `contract_address`    | `VARCHAR(42)` | The address of the specific vesting contract. Cannot be null.             |
| `beneficiary_address` | `VARCHAR(42)` | The wallet address of the beneficiary. Cannot be null.                    |
| `total_amount`        | `VARCHAR(78)` | The total amount of tokens to be vested. Cannot be null.                  |
| `cliff_duration`      | `INTEGER`     | The duration of the cliff period in seconds. Cannot be null.              |
| `vesting_duration`    | `INTEGER`     | The total duration of the vesting period in seconds. Cannot be null.      |
| `start_time`          | `TIMESTAMP`   | The timestamp when the vesting schedule begins. Cannot be null.           |
| `released_amount`     | `VARCHAR(78)` | The amount of tokens already claimed by the beneficiary. Defaults to '0'. |
| `revoked`             | `BOOLEAN`     | Indicates if the vesting schedule has been revoked. Defaults to false.    |

#### vesting_claims

Tracks token claim transactions:

| Column                | Type          | Description                                       |
| --------------------- | ------------- | ------------------------------------------------- |
| `id`                  | `UUID`        | Primary key, unique identifier for the claim.     |
| `vesting_schedule_id` | `UUID`        | Foreign key referencing the vesting schedule.     |
| `amount_claimed`      | `VARCHAR(78)` | The amount of tokens claimed in this transaction. |
| `tx_hash`             | `VARCHAR(66)` | The transaction hash of the claim.                |
| `claimed_at`          | `TIMESTAMP`   | Timestamp of when the claim was made.             |
