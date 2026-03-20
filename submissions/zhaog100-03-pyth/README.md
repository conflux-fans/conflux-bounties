# PYTH Oracle Integration Demo - Conflux eSpace

> Bounty #3: Comprehensive Pyth Network price feed integration on Conflux eSpace

## Overview

This project demonstrates how to integrate [Pyth Network](https://pyth.network) oracle price feeds on [Conflux eSpace](https://confluxnetwork.org). It includes smart contracts, a React-based DApp frontend, comprehensive tests with mocked feeds, and deployment scripts.

## Features

### 🔴 Smart Contracts
- **PriceConsumer** — Reads and validates Pyth price data with staleness and confidence checks
- **PriceTrigger** — Executes on-chain actions when price thresholds are reached
- **MockLendingProtocol** — Demonstrates oracle-based liquidation in a lending protocol
- **PricePredictionMarket** — Prediction market that resolves bets using Pyth oracle prices

### 📊 DApp Frontend
- Real-time price dashboard (BTC/USD, ETH/USD, USDC/USD)
- Price history sparkline charts
- Oracle health and staleness indicators
- Interactive smart contract documentation viewer
- Auto-refreshing price data every 10 seconds

### 🧪 Testing
- MockPythPriceFeed — Full mock implementation for testing without blockchain
- PriceConsumer logic tests (validation, staleness, confidence)
- PriceTrigger logic tests (above/below threshold, one-time execution)
- MockLendingProtocol tests (borrow, liquidation, health checks)
- PricePredictionMarket tests (bet placement, resolution, edge cases)
- Edge case handling (zero prices, large movements, rapid updates)

## Quick Start

### Prerequisites
- Node.js >= 18
- npm or yarn

### Installation

```bash
cd submissions/zhaog100-03-pyth
npm install
```

### Run Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Start DApp

```bash
npm run dev
```

Open http://localhost:3000 to see the price dashboard.

## Architecture

```
submissions/zhaog100-03-pyth/
├── contracts/
│   ├── IPyth.sol              # Pyth oracle interface
│   ├── PythStructs.sol        # Pyth data structures
│   ├── PriceConsumer.sol      # Price reader with validation
│   ├── PriceTrigger.sol       # Threshold-triggered actions
│   ├── MockLendingProtocol.sol # Oracle-based lending demo
│   └── PricePredictionMarket.sol # Prediction market
├── src/
│   ├── App.jsx                # Main React application
│   └── main.jsx               # Entry point
├── tests/
│   ├── mockPriceFeed.test.js  # Mock Pyth implementation
│   └── contractLogic.test.js  # Contract logic tests
├── scripts/
│   └── deploy.ts              # Hardhat deployment script
├── docs/
│   └── INTEGRATION_GUIDE.md   # Integration guide
├── index.html
├── vite.config.js
├── hardhat.config.ts
└── package.json
```

## Pyth Integration on Conflux eSpace

### Contract Addresses
| Network | Pyth Endpoint |
|---------|--------------|
| eSpace Mainnet | `0xe9e45c4a3f58d27ec491327000293359ff618e2f` |
| eSpace Testnet | `0x43cF1c26D56a3e46D6826D615E5Ca7B7a96e5C6b` |

### Price Feed IDs
| Asset | Price Feed ID |
|-------|--------------|
| BTC/USD | `0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72fc6562aedb9` |
| ETH/USD | `0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace` |
| USDC/USD | `0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` |

### Basic Usage

```solidity
// 1. Get price (view function, no update needed for recent data)
(int64 price, uint64 conf, int32 expo,,,) = pyth.getPrice(btcPriceId);
int64 normalizedPrice = price; // Adjust for expo exponent

// 2. Update and get fresh price (requires VAA data from Hermes API)
uint256 fee = pyth.getUpdateFee(updateData);
pyth.updatePriceFeeds{value: fee}(updateData);
(int64 price,,,) = pyth.getPrice(btcPriceId);
```

### Security Best Practices
1. **Always validate staleness** — Reject prices older than 5 minutes
2. **Check confidence intervals** — Reject if uncertainty too wide
3. **Use reentrancy guards** — For contracts that pay out based on price
4. **Implement fallbacks** — Have a backup mechanism if Pyth is down
5. **Use pull-over-push** — Let users trigger price updates, not automated calls

## API Reference

### Pyth Hermes API
```
GET https://xc-mainnet.pyth.network/api/latest_price_feeds?ids[]={PRICE_ID}
```

Response:
```json
[{
  "id": "...",
  "price": { "price": "67500000000", "conf": "500000000", "expo": -8, "publish_time": 1710... }
}]
```

## Environment Variables

```env
# Conflux eSpace RPC
CONFLUX_RPC_URL=https://evm.confluxrpc.com
CONFLUX_TESTNET_RPC_URL=https://evmtestnet.confluxrpc.com

# Pyth
PYTH_ENDPOINT_ADDRESS=0x...
PYTH_PRICE_FEED_IDS='["0x...btc","0x...eth"]'

# Deployment
DEPLOYER_PRIVATE_KEY=0x...
```

## License

MIT
