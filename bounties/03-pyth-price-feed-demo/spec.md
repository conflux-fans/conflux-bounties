# Bounty #03: Pyth Price Feed Demo DApp (eSpace)

## Overview

**Reward**: $1,000

**Difficulty**: 🟢 Small

**Timeline**: 2-3 weeks

**Type**: DeFi Infrastructure, Oracle Integration, Demo Application

## Problem Statement

Conflux eSpace developers need reliable price oracle solutions for DeFi applications, but there's limited documentation and examples for integrating Pyth Network's high-frequency price feeds. Developers struggle to understand how to properly integrate Pyth oracles, handle price updates, and build robust applications that depend on real-time price data on Conflux eSpace.

## Solution Overview

Create a comprehensive demo DApp on Conflux eSpace that showcases Pyth Network price feed integration. The application should include live price data display, smart contract examples that use Pyth data as an oracle, comprehensive testing with mocked feeds, and detailed documentation for developers to learn from and build upon.

## Core Features

### 1. Live Price Feed Display

- Real-time price updates from Pyth Network
- Multiple cryptocurrency pairs (BTC/USD, ETH/USD, CFX/USD)
- Price history charts and trend visualization
- Confidence intervals and data freshness indicators

### 2. Smart Contract Oracle Integration

- Smart contracts that consume Pyth price data
- Price-triggered smart contract functions
- Automated DeFi operations based on price thresholds
- Oracle reliability and fallback mechanisms

### 3. Demo DeFi Applications

- Simple price-based betting/prediction contract
- Automated liquidation demo (mock lending protocol)
- Dynamic fee adjustment based on asset prices
- Cross-asset ratio monitoring and alerts

### 4. Developer Tools & Testing

- Comprehensive unit tests with mocked price feeds
- Price feed simulation and testing utilities
- Integration testing with Pyth testnet feeds
- Error handling and edge case demonstrations

### 5. Educational Documentation

- Step-by-step integration guide
- Best practices for oracle usage
- Security considerations and risk management
- Performance optimization techniques

## Technical Requirements

### Architecture

- **Frontend**: **Vite + React** (lightweight for demo, minimal complexity)
- **Blockchain**: **viem** for RPC interactions (modern alternative to ethers)
- **Backend**: Simple **Express** server for tests and API
- **Smart Contracts**: Solidity with Pyth SDK integration
- **Alternative**: **React + FastAPI** for Python preference
- **Development**: Hardhat for development, testing, and deployment

### Core Components

1. **Price Feed Display**: Real-time price monitoring interface
2. **Oracle Smart Contracts**: Contracts that consume Pyth price data
3. **Demo DeFi Apps**: Example applications using price oracles
4. **Testing Suite**: Mocked feeds and integration tests
5. **Documentation**: Developer guides and tutorials
6. **Monitoring Dashboard**: Oracle health and performance metrics

### Supported Price Feeds

- **Major Cryptocurrencies**: BTC, ETH, CFX
- **Stablecoins**: USDC, USDT, DAI
- **DeFi Tokens**: Popular tokens available on Pyth
- **Custom Feeds**: Framework for adding new price pairs

## Deliverables

### 1. Frontend Application

- [ ]  Real-time price feed dashboard with live updates
- [ ]  Interactive price charts with historical data
- [ ]  Multi-asset price monitoring interface
- [ ]  Oracle health and confidence indicators

### 2. Smart Contract Examples

- [ ]  Basic price oracle consumer contract
- [ ]  Price-triggered automated functions
- [ ]  Mock lending protocol with oracle-based liquidations
- [ ]  Cross-asset ratio monitoring contracts

### 3. Demo DeFi Applications

- [ ]  Price prediction/betting contract with oracle resolution
- [ ]  Dynamic fee adjustment system based on asset prices
- [ ]  Automated liquidation simulator
- [ ]  Price alert and notification system

### 4. Testing Infrastructure

- [ ]  Comprehensive unit tests with mocked price feeds
- [ ]  Integration tests with Pyth testnet
- [ ]  Price feed simulation and testing utilities
- [ ]  Error handling and edge case tests

### 5. Documentation & Guides

- [ ]  Step-by-step Pyth integration tutorial
- [ ]  Smart contract development guide
- [ ]  Security best practices documentation
- [ ]  Performance optimization guide

### 6. Deployment & Configuration

- [ ]  Hardhat deployment scripts for testnet and mainnet
- [ ]  Environment configuration for different networks
- [ ]  Docker containerization for easy setup
- [ ]  CI/CD pipeline for automated testing

## Acceptance Criteria

### Functional Requirements

- ✅ Displays real-time price feeds from Pyth Network
- ✅ Smart contracts successfully consume and use price data
- ✅ Demo applications demonstrate practical oracle usage
- ✅ Includes comprehensive testing with mocked feeds
- ✅ Handles price feed errors and edge cases gracefully
- ✅ Provides educational value for developers

### Technical Requirements

- ✅ Integrates with Pyth Network on Conflux eSpace
- ✅ Implements proper oracle security patterns
- ✅ Handles price staleness and confidence intervals
- ✅ Provides fallback mechanisms for oracle failures
- ✅ Performance optimized for real-time updates

### Quality Requirements

- ✅ 80% minimum test coverage including mocked scenarios
- ✅ Clean, well-documented code with best practices
- ✅ User-friendly interface with responsive design
- ✅ Comprehensive developer documentation
- ✅ Production-ready deployment configuration

## Example User Flows

### Price Monitoring Dashboard

1. **User visits price dashboard**
2. **Real-time prices load** from Pyth Network
3. **Charts display** historical price trends
4. **Confidence intervals** show data reliability
5. **Price alerts** notify of significant changes
6. **Oracle health** indicators show feed status

### Price-Triggered Smart Contract

1. **User deploys betting contract** with price threshold
2. **Contract monitors** BTC/USD price via Pyth oracle
3. **Price threshold reached** triggers automatic execution
4. **Contract validates** price data confidence
5. **Automated payout** executed based on price result
6. **Event logs** record oracle-based decisions

### Mock Liquidation Demo

1. **User deposits collateral** in mock lending protocol
2. **Oracle monitors** collateral asset price continuously
3. **Price drops** below liquidation threshold
4. **Smart contract** automatically triggers liquidation
5. **Liquidation executed** with current oracle price
6. **User interface** shows liquidation event details

## Technical Specifications

### Environment Variables

```
# Network Configuration
CONFLUX_RPC_URL=https://evm.confluxrpc.com
CONFLUX_TESTNET_RPC_URL=https://evmtestnet.confluxrpc.com

# Pyth Configuration
PYTH_ENDPOINT_ADDRESS=0x... # Pyth contract on Conflux eSpace
PYTH_PRICE_FEED_IDS='["0x...btc", "0x...eth", "0x...cfx"]'

# Deployment
DEPLOYER_PRIVATE_KEY=0x...
CONTRACT_ADMIN_ADDRESS=0x...

# Frontend
NEXT_PUBLIC_PYTH_ENDPOINT=0x...
NEXT_PUBLIC_WS_ENDPOINT=wss://...
NEXT_PUBLIC_CHAIN_ID=1030

```

### Smart Contract Examples

```solidity
// Basic price consumer contract
contract PriceConsumer {
    IPyth pyth;
    bytes32 public btcPriceId;

    constructor(address pythContract, bytes32 _btcPriceId) {
        pyth = IPyth(pythContract);
        btcPriceId = _btcPriceId;
    }

    function getLatestPrice() public view returns (int64) {
        PythStructs.Price memory price = pyth.getPrice(btcPriceId);
        return price.price;
    }
}

// Price-triggered automation contract
contract PriceTrigger {
    IPyth public pyth;
    bytes32 public priceId;
    int64 public triggerPrice;
    bool public triggered;

    event PriceTriggered(int64 currentPrice, uint256 timestamp);

    function checkAndTrigger(bytes[] calldata priceUpdateData)
        external payable {
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        PythStructs.Price memory price = pyth.getPrice(priceId);

        if (!triggered && price.price >= triggerPrice) {
            triggered = true;
            emit PriceTriggered(price.price, block.timestamp);
            // Execute triggered logic here
        }
    }
}

// Mock lending protocol with liquidations
contract MockLendingProtocol {
    IPyth public pyth;
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public loans;

    uint256 public constant LIQUIDATION_RATIO = 150; // 150%

    function liquidate(
        address user,
        bytes[] calldata priceUpdateData
    ) external payable {
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        // Check if position is underwater
        uint256 collateralValue = getCollateralValue(user);
        uint256 loanValue = loans[user];

        require(
            collateralValue * 100 < loanValue * LIQUIDATION_RATIO,
            "Position healthy"
        );

        // Execute liquidation logic
        _liquidatePosition(user);
    }
}

```

### Database Schema (Frontend)

```sql
-- Price feed history
CREATE TABLE price_history (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL, -- 'BTC/USD', 'ETH/USD', etc.
  price DECIMAL(20, 8) NOT NULL,
  confidence DECIMAL(20, 8) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  pyth_timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Oracle health metrics
CREATE TABLE oracle_metrics (
  id SERIAL PRIMARY KEY,
  feed_id VARCHAR(66) NOT NULL, -- Pyth price feed ID
  symbol VARCHAR(20) NOT NULL,
  last_update TIMESTAMP NOT NULL,
  update_frequency INTERVAL,
  confidence_avg DECIMAL(10, 6),
  price_deviation DECIMAL(10, 6),
  health_score DECIMAL(4, 2), -- 0-100
  created_at TIMESTAMP DEFAULT NOW()
);

-- Demo transactions
CREATE TABLE demo_transactions (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'bet', 'liquidation', 'trigger'
  user_address VARCHAR(42) NOT NULL,
  trigger_price DECIMAL(20, 8),
  execution_price DECIMAL(20, 8),
  tx_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

```

### Price Feed Configuration

```tsx
export const PRICE_FEEDS = {
  'BTC/USD': {
    id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    symbol: 'BTC/USD',
    description: 'Bitcoin / US Dollar',
    decimals: 8
  },
  'ETH/USD': {
    id: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    symbol: 'ETH/USD',
    description: 'Ethereum / US Dollar',
    decimals: 8
  },
  'CFX/USD': {
    id: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
    symbol: 'CFX/USD',
    description: 'Conflux / US Dollar',
    decimals: 8
  }
};

export const PYTH_CONFIG = {
  endpoint: '0x...',
  updateFee: 1, // CFX
  maxAge: 300, // 5 minutes
  confidenceThreshold: 0.01 // 1%
};

```

### API Endpoints

- `GET /api/prices` - Get current prices for all feeds
- `GET /api/prices/:symbol` - Get price for specific symbol
- `GET /api/prices/:symbol/history` - Get historical price data
- `GET /api/oracle/health` - Get oracle health metrics
- `POST /api/demo/trigger` - Trigger demo contract function
- `GET /api/demo/transactions` - Get demo transaction history

## Bonus Features (Optional)

### Advanced Oracle Features

- Multi-oracle aggregation and comparison
- Custom price feed creation and publishing
- Oracle reputation and reliability scoring
- Advanced price prediction algorithms

### Enhanced Visualization

- 3D price charts and market depth visualization
- Real-time trading view with technical indicators
- Portfolio tracking with oracle-based valuations
- Market sentiment analysis integration

### DeFi Integration

- DEX integration with oracle-based pricing
- Yield farming with dynamic APY calculations
- Options trading with Black-Scholes pricing
- Insurance protocols with oracle-based claims

## Evaluation Criteria

### Code Quality (25%)

- Clean, maintainable Solidity and TypeScript code
- Proper error handling and validation
- Gas optimization for oracle interactions
- Test coverage and quality

### Functionality (35%)

- Pyth integration accuracy and reliability
- Smart contract oracle usage effectiveness
- Demo application completeness
- Real-time data handling quality

### Educational Value (25%)

- Documentation clarity and completeness
- Tutorial effectiveness for developers
- Code examples and best practices
- Security considerations coverage

### User Experience (15%)

- Interface design and usability
- Real-time data visualization quality
- Error handling and user feedback
- Performance and responsiveness

## Security Considerations

### Oracle Security

- Price feed validation and staleness checks
- Confidence interval verification
- Fallback mechanisms for oracle failures
- Protection against oracle manipulation

### Smart Contract Security

- Reentrancy protection for oracle updates
- Access control for admin functions
- Input validation for price data
- Gas limit considerations for updates

### Best Practices

- Multi-oracle redundancy strategies
- Circuit breaker patterns for extreme price moves
- Time-weighted average price (TWAP) calculations
- Oracle front-running protection

## Testing Strategy

### Unit Testing

- Mock price feed testing with various scenarios
- Edge case handling (stale prices, extreme values)
- Contract function testing with different price inputs
- Error condition testing

### Integration Testing

- Real Pyth testnet integration
- End-to-end price update flows
- Multi-contract interaction testing
- Performance testing under load

### Security Testing

- Oracle manipulation resistance
- Price validation edge cases
- Gas optimization verification
- Access control testing

## Resources

### Pyth Network Documentation

- [Pyth Network Developer Docs](https://docs.pyth.network/)
- [Pyth EVM Integration Guide](https://docs.pyth.network/evm)
- [Pyth Price Feeds](https://pyth.network/price-feeds)
- [Pyth SDK Documentation](https://docs.pyth.network/pythnet-price-feeds/pythnet-js)

### Conflux Documentation

- [Conflux eSpace Guide](https://doc.confluxnetwork.org/docs/espace/)
- [DeFi Development on eSpace](https://doc.confluxnetwork.org/docs/espace/DevelopmentGuide)
- [Oracle Integration Best Practices](https://doc.confluxnetwork.org/docs/espace/UserGuide)

### Oracle and DeFi Resources

- [Oracle Security Best Practices](https://blog.chain.link/secure-smart-contract-oracle-development/)
- [DeFi Oracle Attack Vectors](https://consensys.github.io/smart-contract-best-practices/development-recommendations/general/external-calls/)
- [Price Feed Reliability Patterns](https://ethereum.org/en/developers/docs/oracles/)

### Development Tools

- [Hardhat Documentation](https://hardhat.org/docs)
- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [ethers.js Documentation](https://docs.ethers.org/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

---

**Ready to build the future of DeFi oracles on Conflux?** Comment `/claim` on the GitHub issue to get started!