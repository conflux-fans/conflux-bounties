# 🔮 Pyth Price Feed Demo Dapp - Complete Project Guide

**Full-Stack Decentralized Price Monitoring Platform**  

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Solidity](https://img.shields.io/badge/Solidity-^0.8.20-363636.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-3178C6.svg)

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation Guide](#installation-guide)
5. [Smart Contract Setup](#smart-contract-setup)
6. [Backend Configuration](#backend-configuration)
7. [Frontend Development](#frontend-development)
8. [Docker Deployment](#docker-deployment)
9. [API Documentation](#api-documentation)
10. [Testing & Coverage](#testing--coverage)
11. [Security Considerations](#security-considerations)
12. [Troubleshooting](#troubleshooting)

---

## 🌟 Project Overview

### What is This?

A DeFi monitoring platform that integrates **Pyth Network** oracles for real-time cryptocurrency price feeds on **Conflux eSpace**. 

### Key Features

✅ **Real-time Price Tracking**: BTC, ETH, CFX with live updates  
✅ **TradingView-Style Charts**: Interactive, responsive price charts  
✅ **Price Alerts**: Customizable notifications via webhooks  
✅ **Liquidation Monitoring**: Track DeFi position liquidations  
✅ **WebSocket Streaming**: Sub-second price updates  
✅ **Smart Contract Integration**: Trustless on-chain price data  
✅ **Docker Ready**: One-command deployment  
✅ **High Test Coverage**: >80% for contracts, >80% for backend

### Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Blockchain** | Solidity 0.8.20, Hardhat, OpenZeppelin |
| **Oracle** | Pyth Network |
| **Backend** | Node.js, Express, TypeScript, WebSocket |
| **Frontend** | React, Vite, TailwindCSS, Recharts |
| **DevOps** | Docker, Docker Compose, Nginx |
| **Testing** | Hardhat, Jest, Chai |

---

## 🏗️ Architecture

### Data Flow

1. **Pyth Network** → Real-time price feeds
2. **Backend Service** → Processes and caches prices
3. **WebSocket** → Streams to frontend
4. **Smart Contract** → On-chain price verification
5. **Frontend** → Displays charts and alerts

---

## 📦 Prerequisites

### System Requirements

#### Required Software

`Node.js >= 18.0.0`
`npm >= 9.0.0`
`Git >= 2.0.0`
`Docker >= 20.10.0 (optional)`
`Docker Compose >= 2.0.0 (optional)`

#### Optional Tools
`Hardhat CLI`
`MetaMask Extension`
`VS Code + Solidity Extension`


### Check Installation

```bash
node --version   # v18.0.0+
npm --version    # 9.0.0+
git --version    # 2.0.0+
docker --version # 20.10.0+ (optional)
```

### Get Testnet Tokens

1. **Install MetaMask**: `https://metamask.io/`
2. **Add Conflux eSpace Testnet**:
   - Network Name: `Conflux eSpace Testnet`
   - RPC URL: `https://evmtestnet.confluxrpc.com`
   - Chain ID: `71`
   - Currency: `CFX`
   - Explorer: `https://evmtestnet.confluxscan.io`
3. **Get CFX**: Visit `https://efaucet.confluxnetwork.org/`

---

## 🚀 Installation Guide

### Step 1: Clone Repository

```bash
git clone https://github.com/AmirMP12/pyth-oracle-dapp.git
cd pyth-oracle-dapp
```

### Step 2: Install All Dependencies


#### Root dependencies
```bash
npm install
```
#### Contract dependencies
```bash
cd contracts
npm install
```
#### Backend dependencies
```bash
cd ../backend
npm install
```
#### Frontend dependencies
```bash
cd ../frontend
npm install
```
#### Return to root
```bash
cd ..
```

### Step 3: Verify Installation


#### Check if everything installed correctly
```bash
npm run verify-setup
```

---

## 📜 Smart Contract Setup

### 1. Environment Configuration

Create `contracts/.env`:

```bash
# Private Key (DO NOT COMMIT)
PRIVATE_KEY=

# Network Configuration
CONFLUX_RPC_URL=https://evmtestnet.confluxrpc.com
CONFLUX_MAINNET_RPC=https://evm.confluxrpc.com

# Pyth Oracle Addresses
PYTH_TESTNET_ADDRESS=0xDd24F84d36BF92C65F92307595335bdFab5Bbd21
PYTH_MAINNET_ADDRESS=0xe9d69CdD6Fe41e7B621B4A688C5D1a68cB5c8ADc

```

### 2. Compile Contracts

```bash
cd contracts
npx hardhat compile
```

**Expected Output:**
```bash
Compiled 14 Solidity files successfully
```

### 3. Run Tests

```bash
npx hardhat test
```

**Expected Output:**
```bash
  DynamicFeeManager
    Constructor
      ✔ Should set Pyth address correctly
      ✔ Should revert with invalid Pyth address (66ms)
      ✔ Should set owner correctly
    Fee Configuration
      ✔ Should configure a fee correctly
      ✔ Should revert when non-owner tries to configure (48ms)
      ✔ Should revert on base fee too high
      ✔ Should revert on low volatility fee too high
      ✔ Should revert on high volatility fee too high
      ✔ Should revert on invalid thresholds
      ✔ Should update fee configuration
    Fee Calculation
      ✔ Should calculate fee based on price volatility (48ms)
      ✔ Should return base fee for normal volatility
      ✔ Should increase fee for high volatility (below threshold)
      ✔ Should increase fee for high volatility (above threshold)
      ✔ Should revert when fee not configured
      ✔ Should calculate fee for different amounts
    Get Current Fee Rate
      ✔ Should return current fee rate for normal volatility
      ✔ Should return high volatility fee rate
      ✔ Should revert when fee not configured
    Multiple Assets
      ✔ Should handle multiple configured assets

  FallbackOracle
    ✔ Should return primary oracle price if not in fallback mode
    ✔ Should enter and exit fallback mode (54ms)
    ✔ Should update fallback price by trusted updater when in fallback mode
    ✔ Should revert updating fallback price when not in fallback mode (47ms)
    ✔ Should revert getting fallback price if not set
    ✔ Should revert on untrusted updater
    ✔ Should remove trusted updater
    ✔ Should revert on invalid updater address
    ✔ Should revert adding/removing trusted updater by non-owner
    ✔ Fallback mode events fire again when re-entering/exiting
    ✔ Trusted updater events fire

  Pyth Integration Tests
    Cross-Contract Price Consistency
      ✔ Should provide consistent prices across all contracts
      ✔ Should handle price updates correctly
      ✔ Should handle multiple price feeds
      ✔ Should place bets with different price feeds
      ✔ Should settle bets using correct price feed (72ms)

  MockLendingProtocol
    Constructor
      ✔ Should set the Pyth contract address
      ✔ Should revert with zero address
    Open Position
      ✔ Should open a position successfully
      ✔ Should track user positions
      ✔ Should revert with no collateral
      ✔ Should revert with zero borrow amount
      ✔ Should revert with insufficient liquidity
    Health Ratio
      ✔ Should calculate health ratio correctly
      ✔ Should return high ratio for very small borrow
      ✔ Should revert for inactive position
    Get Position Details
      ✔ Should return correct position details
      ✔ Should revert for inactive position
    Liquidation
      ✔ Should liquidate unhealthy position
      ✔ Should revert liquidating healthy position
      ✔ Should pay liquidation bonus
      ✔ Should revert liquidating inactive position
    Repay Position
      ✔ Should repay position successfully
      ✔ Should return collateral on repay
      ✔ Should refund excess repayment (56ms)
      ✔ Should revert if not position owner
      ✔ Should revert with insufficient repayment
      ✔ Should revert repaying inactive position
    Get All Active Positions
      ✔ Should return empty array when no positions
      ✔ Should return all active positions
      ✔ Should exclude closed positions
    Receive Function
      ✔ Should accept ETH

  MockPyth
    setMockPrice
      ✔ Should set mock price correctly
      ✔ Should set multiple prices
      ✔ Should update existing price
      ✔ Should handle positive exponent
      ✔ Should handle zero values
      ✔ Should handle negative price
    getPriceUnsafe
      ✔ Should get price without age check
      ✔ Should get old price without revert
      ✔ Should return zero values for unset price
    getPriceNoOlderThan
      ✔ Should get price within valid age
      ✔ Should revert on stale price
      ✔ Should work with large age requirement
    Not Implemented Functions
      ✔ Should revert getPrice
      ✔ Should revert getEmaPrice
      ✔ Should revert getEmaPriceUnsafe
      ✔ Should revert getEmaPriceNoOlderThan
      ✔ Should revert parsePriceFeedUpdates
      ✔ Should revert parsePriceFeedUpdatesUnique
    Update Functions
      ✔ Should accept updatePriceFeeds
      ✔ Should accept updatePriceFeedsIfNecessary
    getUpdateFee
      ✔ Should return zero
    getValidTimePeriod
      ✔ Should return 60
    Integration
      ✔ Should handle complete lifecycle
      ✔ Should handle multiple assets
    Edge Cases
      ✔ Should handle max int64
      ✔ Should handle very old timestamp

  PriceConsumer
    Constructor
      ✔ Should set Pyth address correctly
      ✔ Should revert with invalid Pyth address
    getLatestPrice
      ✔ Should fetch latest price with correct values
      ✔ Should work for multiple assets
    getFormattedPrice - Tests PythOracleUtils.formatPrice
      ✔ Should format price correctly
      ✔ Should format different assets
      ✔ Should handle all exponent cases - COVERS LINES 129,130,132
      ✔ Should handle zero exponent
    getBatchPrices
      ✔ Should batch fetch multiple prices
      ✔ Should handle single price
      ✔ Should handle three or more prices
    isPriceStale
      ✔ Should check price staleness correctly
      ✔ Should return false for non-stale price
    getLatestPriceNoOlderThan
      ✔ Should revert on stale price
      ✔ Should return price with sufficient threshold
    Edge Cases
      ✔ Should handle zero price
      ✔ Should handle negative price
      ✔ Should handle high confidence
      ✔ Should handle maximum int64 price

  PriceFeedBetting
    Constructor
      ✔ Should set Pyth address and owner
      ✔ Should revert with invalid Pyth address
    Place Bet - Branch Coverage
      ✔ Should place a bet predicting ABOVE
      ✔ Should place a bet predicting BELOW
      ✔ Should place bets on different price feeds
      ✔ Should revert on bet amount BELOW minimum
      ✔ Should revert on bet amount ABOVE maximum
      ✔ Should accept bet amount AT minimum
      ✔ Should accept bet amount AT maximum
      ✔ Should revert on duration BELOW minimum
      ✔ Should revert on duration ABOVE maximum
      ✔ Should accept duration AT minimum
      ✔ Should accept duration AT maximum
      ✔ Should revert on zero target price
      ✔ Should revert on negative target price
      ✔ Should track user bets
    Settle Bet - Branch Coverage
      ✔ Should settle ABOVE bet as WON (price >= target)
      ✔ Should settle ABOVE bet as LOST (price < target)
      ✔ Should settle BELOW bet as WON (price <= target)
      ✔ Should settle BELOW bet as LOST (price > target)
      ✔ Should revert settlement BEFORE deadline
      ✔ Should revert on ALREADY SETTLED bet
      ✔ Should collect platform fees
    Fee Management
      ✔ Should allow owner to withdraw fees
      ✔ Should revert fee withdrawal by non-owner
    Multiple Bets
      ✔ Should handle multiple simultaneous bets
    Receive Function
      ✔ Should accept ETH

  PriceConsumer - PythOracleUtils Integration
    getFormattedPrice - COVERS LINES 129,130,132
      ✔ Should format with LARGE negative exponent (LINE 129)
      ✔ Should format with SMALL negative exponent (LINES 130-132)
      ✔ Should format with exact STANDARD_DECIMALS (-18)
      ✔ Should format with positive exponent
      ✔ Should format with zero exponent
      ✔ Should format regular case (-8)
    isPriceStale - Tests PythOracleUtils.isPriceStale
      ✔ Should return true for stale price
      ✔ Should return false for fresh price
      ✔ Should handle exact threshold
    getLatestPriceNoOlderThan - Tests PythOracleUtils.getPriceWithAge
      ✔ Should revert on stale price
      ✔ Should return valid price within threshold
      ✔ Should work with different assets
    getBatchPrices - Tests multiple price fetching
      ✔ Should fetch multiple prices
      ✔ Should fetch single price
      ✔ Should fetch three prices
    Edge Cases
      ✔ Should handle zero price
      ✔ Should handle negative price
      ✔ Should handle very high confidence
      ✔ Should handle maximum int64

  PythOracleUtilsWrapper - Full Coverage
    formatPrice
      ✔ Large negative exponent
      ✔ Small negative exponent
      ✔ Zero exponent
      ✔ Positive exponent
      ✔ STANDARD_DECIMALS (-18)
      ✔ Reverts on zero price
    Price reliability and confidence
      ✔ Reliable price
      ✔ Unreliable price
      ✔ Confidence ratio normal
      ✔ Confidence ratio zero price returns max
    Price staleness
      ✔ Detects stale price
      ✔ Detects fresh price
    Safe price & age
      ✔ Gets safe price
      ✔ Reverts on stale safe price
      ✔ Gets price with age
      ✔ Reverts on maxAge=0
    Average & difference
      ✔ Average for one asset
      ✔ Average for multiple assets
      ✔ Reverts on empty priceIds
      ✔ Price difference normal
      ✔ Price difference zero price returns max
    Decimal conversion
      ✔ Convert up
      ✔ Convert down
      ✔ Same decimals


  177 passing (14s)
  ```


### 4. Generate Coverage Report

```bash
npx hardhat coverage
```

#### Target: >80% coverage 

### 5. Deploy to Conflux eSpace

```bash
npx hardhat run scripts/deploy.ts --network eSpaceMainnet
```

**Expected Output:**
```bash
🔍 DEBUG INFO:
Private Key exists: true
Private Key length: 64
RPC URL: https://evm.confluxrpc.com
─────────────────────────────────────────

🚀 Starting deployment...

📋 Deployment Configuration:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Network:   conflux
Chain ID:  1030
Deployer:  0x1234...ABCD
Balance:   9.87654321 CFX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Using Pyth Oracle at: 0xe9d69CdD6Fe41e7B621B4A688C5D1a68cB5c8ADc

📊 Price Feed IDs:
  BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
  ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
  CFX/USD: 0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933

1️⃣ Deploying PriceConsumer...
✅ PriceConsumer: 

2️⃣ Deploying PriceFeedBetting...
✅ PriceFeedBetting: 
   Supports: BTC, ETH, CFX price feeds

3️⃣ Deploying MockLendingProtocol...
✅ MockLendingProtocol: 

💰 Funding lending protocol...
✅ Funded with 1 CFX

4️⃣ Deploying DynamicFeeManager...
✅ DynamicFeeManager: 

5️⃣ Deploying FallbackOracle...
✅ FallbackOracle: 

🔍 Verifying deployments...
  Betting owner: 0x1234...ABCD
  Lending next position ID: 0
✅ Verification complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 DEPLOYMENT SUCCESSFUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Contract Addresses:
Pyth Oracle:        
PriceConsumer:      
PriceFeedBetting:   
MockLendingProtocol:
DynamicFeeManager:  
FallbackOracle:     

📁 Deployment files:
  Full:     deployments/conflux-1728493729301.json
  Latest:   deployments/conflux-latest.json
  Frontend: deployments/conflux-frontend.json
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Next Steps:
1. Update frontend config with addresses from frontend.json
2. Test betting with multiple assets (BTC, ETH, CFX)
3. Create lending positions
4. Verify contracts on block explorer
```



### 6. Save Contract Address

**IMPORTANT:** Copy the deployed contract address and save it to:
- `backend/.env` as `CONTRACT_ADDRESSES`
- `frontend/.env` as `VITE_CONTRACT_ADDRESSES`

---

## 🖥️ Backend Configuration

### 1. Environment Setup

Create `backend/.env`:

```bash
# Server Configuration
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173

# Pyth Configuration
PYTH_HERMES_URL=https://hermes.pyth.network

# Conflux Configuration
CONFLUX_RPC_URL=https://evm.confluxrpc.com
CONFLUX_CHAIN_ID=1030

# Logging
LOG_LEVEL=info

# Contract Addresses (update after deployment)
PRICE_CONSUMER_ADDRESS=0x
BETTING_CONTRACT_ADDRESS=0x
LENDING_CONTRACT_ADDRESS=0x
``` 
# Server Configuration
```bash
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Pyth Network
PYTH_ENDPOINT=https://hermes.pyth.network
PYTH_WS_ENDPOINT=wss://hermes.pyth.network/ws

# Price Feed IDs (Must match contracts)
BTC_FEED_ID=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
ETH_FEED_ID=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
CFX_FEED_ID=0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933

# Blockchain
RPC_URL=https://evm.confluxrpc.com
CHAIN_ID=1030

# Monitoring & Alerts
LOG_LEVEL=info
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Database (Optional - for persistent storage)
# MONGODB_URI=mongodb://localhost:27017/pyth-oracle
# REDIS_URL=redis://localhost:6379

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Project Structure

```bash
backend/
├── src/
│   ├── server.ts                  # Main entry point
│   │
│   ├── routes/                    # API routes
│   │   ├── prices.ts              # Price endpoints
│   │   ├── alerts.ts              # Alert management
│   │   └── liquidations.ts        # Liquidation tracking
│   │
│   ├── services/                  # Business logic & integrations
│   │   ├── alertService.ts        # Alert logic
│   │   ├── priceHistory.ts        # Price history handling
│   │   ├── pythService.ts         # Pyth integration
│   │   └── WebsocketService.ts    # WebSocket connections
│   │
│   ├── utils/                     # Utility functions
│   │   ├── logger.ts              # Winston logger setup
│   │   └── priceFormatter.ts      # Price formatting helpers
│   │
│   └── types/                     # TypeScript type definitions
│       └── index.ts
│
├── tests/
│   ├── unit/                      # Unit tests
│   │   ├── services/
│   │   │   ├── alertService.test.ts
│   │   │   ├── priceHistory.test.ts
│   │   │   ├── pythService.test.ts
│   │   │   └── WebsocketService.test.ts
│   │   │
│   │   ├── types/
│   │   │   └── index.test.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── logger.test.ts
│   │   │   └── priceFormatter.test.ts
│   │
│   ├── integration/               # Integration tests
│   │   ├── alerts.test.ts
│   │   ├── server.test.ts
│   │   ├── liquidations.test.ts
│   │   └── prices.test.ts
│   │
│   ├── _mock_/                 # Test mocks
│   │   └── logger.ts
│   │
│   └── setup.ts                   # Jest setup file
│
├── logs/                          # Log files
│   ├── combined.log
│   └── error.log
│
├── .env                           # Environment variables
├── package.json                   # Dependencies & scripts
├── jest.config.js                 # Jest configuration
└── tsconfig.json                  # TypeScript configuration
```

### 3. Build Backend

```bash
cd backend
npm run build
```

### 4. Run Tests

```bash
npm test
npm run test:coverage
```

### 5. Start Development Server

```bash
npm run dev
```

**Expected Console Output:**

```bash
============================================================
🚀 Server running on http://localhost:3001
📡 WebSocket server: ws://localhost:3001/ws
🌐 Environment: development
============================================================
📋 Available Routes:
   GET  http://localhost:3001/
   GET  http://localhost:3001/health
   GET  http://localhost:3001/api/prices/current
   GET  http://localhost:3001/api/prices/:symbol
   GET  http://localhost:3001/api/alerts/:userAddress
   POST http://localhost:3001/api/alerts
============================================================
```

### 6. Test Endpoints


# Health check
```bash
curl http://localhost:3001/health
```
# Expected response:
```bash
{
   "status": "healthy",
   "timestamp": "2025-10-09T08:30:00.000Z",
   "uptime": 123.45
}
```
# Get all prices
```bash
curl http://localhost:3001/api/prices/current | jq
```
# Get specific price
```bash
curl http://localhost:3001/api/prices/CFX | jq
```
# Get alerts
```bash
curl http://localhost:3001/api/alerts/:useraddress | jq
```
# Create alert
```bash
curl -X POST http://localhost:3001/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTC",
    "targetPrice": 125000,
    "condition": "above"
  }' | jq
```

## 🎨 Frontend Development

### 1. Environment Configuration

Create `frontend/.env`:

```bash
# Conflux Network
VITE_NETWORK_NAME=eSpaceMainnet
VITE_CHAIN_ID=1030
VITE_RPC_URL=https://evm.confluxrpc.com

# Contract Addresses
VITE_PYTH_ORACLE_ADDRESS=0x
VITE_PRICE_CONSUMER_ADDRESS=0x
VITE_BETTING_ADDRESS=0x
VITE_LENDING_ADDRESS=0x
VITE_FEE_MANAGER_ADDRESS=0x
VITE_FALLBACK_ORACLE_ADDRESS=0x

# Price Feed IDs
VITE_BTC_PRICE_ID=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
VITE_ETH_PRICE_ID=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
VITE_CFX_PRICE_ID=0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933
```

### 2. Project Structure

```bash
frontend/
├── src/
│   ├── app.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── vite-env.d.ts
│   │
│   ├── components/
│   │   ├── AlertManager.tsx
│   │   ├── BettingInterface.tsx
│   │   ├── Layout.tsx
│   │   ├── LiquidationManager.tsx
│   │   ├── PriceChart.tsx
│   │   ├── PriceDashboard.tsx
│   │   └── WalletConnect.tsx
│   │
│   ├── hooks/
│   │   ├── usePythPrices.ts
│   │   ├── useWebSocket.ts
│   │   ├── useContract.ts
│   │   └── useLiquidation.ts
│   │
│   ├── lib/
│   │   ├── chains.ts
│   │   ├── constants.ts
│   │   ├── contractABI.ts
│   │   ├── pythClient.ts
│   │   ├── viemClient.ts
│   │   └── env.ts
│   │
│   ├── providers/
│   │   └── Web3Provider.tsx
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   └── tests/
│       ├── AlertManager.test.tsx
│       ├── app.test.tsx
│       ├── BettingInterface.test.tsx
│       ├── chains.test.ts
│       ├── constants.test.ts
│       ├── contractABI.test.ts
│       ├── env.test.ts
│       ├── Layout.test.tsx
│       ├── LiquidityMonitor.test.tsx
│       ├── PriceChart.test.tsx
│       ├── PriceDashboard.test.tsx
│       ├── pythClient.test.ts
│       ├── useContracts.test.ts
│       ├── useLiquidations.test.ts
│       ├── usePythPrices.test.ts
│       ├── useWebSocket.test.ts
│       ├── viemClient.test.ts
│       ├── WalletConnect.test.tsx
│       └── WebProvider.test.tsx
│
├── public/
│   ├── bitcoin.png
│   ├── ethereum.png
│   ├── conflux.png
│   ├── cfx.png
│   ├── confi.png
│   ├── conf.png
│   └── notification.wav
│
├── .env
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.ts
├── jest.config.js
└── jest.setup.ts  
```

### 3. Install Dependencies

```bash
cd frontend
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

**Expected Output:**
```bash
  VITE v4.5.0  ready in 1234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### 5. Build for Production

```bash
npm run build
```

**Output:**
```bash
vite v4.5.0 building for production...
✓ 5295 modules transformed.
dist/index.html                           0.59 kB │ gzip:   0.35 kB
dist/assets/index-BH_naeiw.css           27.13 kB │ gzip:   5.06 kB
dist/assets/ccip-CRjDIjh-.js              2.71 kB │ gzip:   1.30 kB │ map:    10.15 kB
dist/assets/metamask-sdk-DSmpcUcG.js    556.25 kB │ gzip: 170.16 kB │ map: 1,394.34 kB
dist/assets/index-CdW5Wib8.js         1,096.61 kB │ gzip: 320.15 kB │ map: 4,548.58 kB
✓ built in 19.02s
```

### 6. Preview Production Build

```bash
npm run preview
```

---

## 🐳 Docker Deployment

### 1. Create Docker Files

#### `docker-compose.yml` (Project Root)

```bash
version: '3.8'

services:
  frontend:
    build:
      context: ../
      dockerfile: docker/Dockerfile.frontend
    ports:
      - "5173:80"
    environment:
      - VITE_BACKEND_URL=http://backend:3000
      - VITE_WS_URL=ws://backend:3000
      - VITE_CONFLUX_RPC=https://evm.confluxrpc.com
    depends_on:
      - backend
    networks:
      - app-network
    restart: unless-stopped

  backend:
    build:
      context: ../
      dockerfile: docker/Dockerfile.backend
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - PYTH_HERMES_URL=https://hermes.pyth.network
      - CONFLUX_RPC_URL=https://evm.confluxrpc.com
      - LOG_LEVEL=info
    volumes:
      - backend-logs:/app/logs
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped
    command: redis-server --appendonly yes

volumes:
  backend-logs:
  redis-data:

networks:
  app-network:
    driver: bridge
```

#### `backend/Dockerfile`

```bash
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./
COPY backend/tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY backend/src ./src

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "dist/server.js"]
```

#### `frontend/Dockerfile`

```bash
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY frontend/package*.json ./

# Install dependencies using npm
RUN npm install

# Copy source code
COPY frontend/ .

# Build application
RUN npm run build

FROM nginx:alpine

# Copy built files to nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### `frontend/nginx.conf`

```bash
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy (optional)
    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

### 2. Build and Deploy

```bash
# Build all images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

**Expected Output:**
```bash
NAME                IMAGE                SERVICE       STATUS                   PORTS
docker-backend-1    docker-backend       backend       Up 3 minutes (healthy)   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp
docker-frontend-1   docker-frontend      frontend      Up 3 minutes             0.0.0.0:5173->80/tcp, [::]:5173->80/tcp
docker-redis-1      redis:7-alpine       redis         Up 3 minutes             0.0.0.0:6379->6379/tcp, [::]:6379->6379/tcp
```

### 3. Docker Management Commands

```bash
# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart single service
docker-compose restart backend

# View logs for specific service
docker-compose logs -f backend

# Execute commands in container
docker-compose exec backend sh

# Scale backend (horizontal scaling)
docker-compose up -d --scale backend=3

# Update and restart
docker-compose pull
docker-compose up -d
```

---

## 📡 API Documentation

### REST API Endpoints

#### Health Check
```bash
GET /health
```

**Response (200 OK):**
```bash
{
  "status": "healthy",
  "timestamp": "2025-10-09T08:30:00.000Z",
  "uptime": 12345.67,
  "version": "1.0.0"
}
```

---

#### Get All Prices
```bash
GET /api/prices/current
```

**Response (200 OK):**
```bash
{
  "BTC": {
    "formattedPrice": "123456.78",
    "confidence": "0.95",
    "publishTime": 1728456789,
    "expo": -8,
    "rawPrice": 123456780000000
  },
  "ETH": {
    "formattedPrice": "4532.95",
    "confidence": "0.85",
    "publishTime": 1728456790,
    "expo": -8,
    "rawPrice": 453295000000
  },
  "CFX": {
    "formattedPrice": "0.1523",
    "confidence": "0.75",
    "publishTime": 1728456791,
    "expo": -8,
    "rawPrice": 15230000
  }
}

```
---

#### Get Specific Price
```bash
GET /api/prices/:symbol
```

**Parameters:**
- `symbol` (path): BTC | ETH | CFX

**Example:**
```bash
curl http://localhost:3001/api/prices/BTC
```
**Response (200 OK):**
```bash
{
  "formattedPrice": "123456.78",
  "confidence": "0.95",
  "publishTime": 1728456789,
  "expo": -8,
  "rawPrice": 123456780000000
}


**Error Response (404):**

{
  "error": "Symbol not found",
  "message": "Price data for XYZ not available"
}
```

---

#### Get All Alerts
```bash
GET /api/alerts/:useraddress
```
**Response (200 OK):**
```bash
{
  "alerts": [
    {
      "id": "alert_1728456789_abc123",
      "symbol": "BTC",
      "targetPrice": 125000,
      "condition": "above",
      "createdAt": "2025-10-09T08:00:00.000Z",
      "isActive": true
    }
  ],
  "count": 1
}
```

---

#### Create Alert
```bash
POST /api/alerts
Content-Type: application/json
```
**Request Body:**
```bash

{
  "symbol": "BTC",
  "targetPrice": 125000,
  "condition": "above"
}


**Response (201 Created):**

{
  "id": "alert_1728456789_abc123",
  "symbol": "BTC",
  "targetPrice": 125000,
  "condition": "above",
  "createdAt": "2025-10-09T08:00:00.000Z",
  "isActive": true
}


**Error Response (400):**

{
  "error": "Missing required fields",
  "message": "symbol, targetPrice, and condition are required"
}
```

---
#### Delete Alert
```bash
DELETE /api/alerts/:id
```
**Response (200 OK):**
```bash
{
  "message": "Alert deleted successfully"
}
```
---

### WebSocket API

#### Connection
```bash
const ws = new WebSocket('ws://localhost:3001/ws');
```

#### Subscribe to Prices
```bash
ws.send(JSON.stringify({
  type: 'subscribe',
  symbols: ['BTC', 'ETH', 'CFX']
}));
```

#### Receive Price Updates
```bash
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // {
  //   type: 'price_update',
  //   data: {
  //     BTC: {
  //       price: '123456.78',
  //       change: '+2.5%',
  //       timestamp: 1728456789
  //     }
  //   }
  // }
};
```

#### Unsubscribe
```bash
ws.send(JSON.stringify({
  type: 'unsubscribe',
  symbols: ['CFX']
}));
```

---

## 🧪 Testing & Coverage

### Smart Contract Testing

```bash
cd contracts

# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/FallbackOracle.test.ts

# Generate coverage
npx hardhat coverage
```

**Coverage Report:**
```bash

------------------|---------|----------|---------|---------|
File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|
All files         |   98.3  |   86.3   |   98.4  |   98.2  |
 src/             |   99.0  |   88.0   |   100   |   99.3  |
 src/mocks/       |   100   |   100    |   100   |   100   |
 src/utils/       |   96.7  |   82.6   |   96.5  |   95.9  |
------------------|---------|----------|---------|---------|

```

---

### Backend Testing

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/services/PythService.test.ts

# Run integration tests
npm run test:integration

# Watch mode
npm run test:watch
```


**Expected Coverage:**
```bash

------------------|---------|----------|---------|---------|
File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|
All files         |   99.0  |   98.7   |   98.3  |   99.0  |
 routes/          |   100   |   100    |   100   |   100   |
 services/        |   98.2  |   97.2   |   97.6  |   98.2  |    
 utils/           |   100   |   100    |   100   |   100   |
------------------|---------|----------|---------|---------|
```

---

### Frontend Testing

```bash
cd frontend

# Run all tests
npm run test

# Run with coverage
npm run test:coverage

```
---

## 🔒 Security Considerations

### Smart Contract Security

1. **Access Control**

```bash
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;
}
```

2. **Reentrancy Protection**

```bash
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PriceOracle is ReentrancyGuard {
    function withdraw() external nonReentrant {
        // Safe from reentrancy
    }
}
```

3. **Integer Overflow/Underflow**
```bash
// Solidity 0.8+ has built-in protection
uint256 result = a + b; // Automatically reverts on overflow
```

---

### Backend Security

1. **Environment Variables**
```bash
# Never commit .env files
# Use .env.example for templates
```

2. **CORS Configuration**
```bash
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));
```

3. **Rate Limiting**
```bash
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests',
});
```

4. **Input Sanitization**
```bash
import validator from 'validator';

const sanitizeInput = (input: string) => {
  return validator.escape(validator.trim(input));
};
```

---

### Frontend Security

1. **XSS Prevention**
```bash
// Never use dangerouslySetInnerHTML
// Use text content instead:
<div>{userInput}</div>
```

2. **HTTPS Only**
```bash
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
}
```

3. **Content Security Policy**
```bash
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'">
```

---
## 🐛 Troubleshooting
### Common Issues & Solutions

1. **Contract Deployment Fails**

Error:

```bash
Error: insufficient funds for gas * price + value
```

Solution:

```bash
1. Check your balance:

2. If low, get testnet tokens: Conflux Faucet

3. Or reduce gas price in hardhat.config.ts:

networks: {
  confluxTestnet: {
    gasPrice: 20000000000, // 20 Gwei
  }
}
```
2. **Backend Can't Connect to Pyth**
   
Error:

```bash
Error: Failed to fetch prices from Pyth Network
```

Solution:

```bash
1. Test Pyth API directly:

curl "https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xe62df6c..."

2. Check your feed IDs in .env.

3. Verify network connectivity:

ping hermes.pyth.network

4. Try alternative endpoint:

PYTH_ENDPOINT=https://xc-mainnet.pyth.network
```

3. **TypeScript Compilation Errors**

Error:

```bash
TS1192: Module has no default export
```

Solution:

```bash
1. Clean and rebuild:

rm -rf dist/ node_modules/
npm install
npm run build

2. Or update tsconfig.json:

{
  "compilerOptions": {
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}

```
4. **Docker Container Won't Start**

Error:

```bash
Container exits with code 137
```

Solution:

```bash
1. Increase Docker memory:
Docker Desktop → Settings → Resources → Memory: 4GB+

2. Check container logs:

docker-compose logs backend

3. Restart with clean slate:

docker-compose down -v
docker system prune -a
docker-compose up -d --build

```
5. **WebSocket Connection Drops**

Error:

```bash
WebSocket connection closed unexpectedly
```

Solution:

```bash
1. Add reconnection logic in frontend:

let ws;
let reconnectInterval;

function connect() {
  ws = new WebSocket(VITE_WS_URL);
  ws.onclose = () => {
    console.log('Reconnecting in 5s...');
    clearTimeout(reconnectInterval);
    reconnectInterval = setTimeout(connect, 5000);
  };
}

2. Add heartbeat in backend:

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

```
## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Pyth Network** - Oracle infrastructure
- **Conflux Network** - Blockchain platform
- **OpenZeppelin** - Smart contract security
- **Hardhat** - Development framework
- **React** - Frontend library
- **TypeScript** - Type safety
