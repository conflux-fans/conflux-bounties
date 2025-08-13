# Bounty #02: ERC20 + Vesting Contract Factory

## Overview

**Reward**: $1,000

**Difficulty**: 🟢 Small

**Timeline**: 2-3 weeks

**Type**: Smart Contracts, DeFi, Factory Pattern

## Problem Statement

Token launches and fundraising projects on Conflux eSpace need a simple way to deploy ERC20 tokens with built-in vesting mechanisms for team allocations, investor distributions, and community rewards. Currently, teams must deploy and configure multiple contracts separately, which is complex, error-prone, and expensive. There's a need for a unified factory solution that handles both token deployment and vesting in a single transaction.

## Solution Overview

Build a Factory smart contract that allows users to deploy a new ERC20 token and configure vesting conditions in a single transaction. The system should support both cliff and linear vesting schedules, handle complex allocation scenarios, and include a user-friendly frontend for collecting deployment parameters and managing vested tokens.

## Core Features

### 1. Factory Contract System

- Single transaction deployment of token + vesting contracts
- Configurable token parameters (name, symbol, supply, allocations)
- Multiple vesting schedule support per token
- Gas-optimized deployment through minimal proxy patterns

### 2. Vesting Logic Implementation

- Cliff vesting (tokens locked until specific date)
- Linear vesting (tokens released gradually over time)
- Combined cliff + linear vesting schedules
- Multiple beneficiary support with different schedules

### 3. Token Management

- Standard ERC20 functionality with OpenZeppelin base
- Initial token distribution and allocation
- Owner controls for token management
- Integration with vesting for locked allocations

### 4. Frontend Interface

- User-friendly deployment interface
- Vesting schedule configuration UI
- Beneficiary management dashboard
- Token claiming interface for vested tokens

### 5. Batch Operations

- Deploy multiple token projects via script
- Batch vesting schedule creation
- CSV import for large beneficiary lists
- Launchpad-style project management

## Technical Requirements

### Architecture

- **Frontend**: **Remix** wizard UI (form actions ideal for deployment flows)
- **Backend**: **NestJS** job worker for batch deploy processing
- **Database**: **Supabase** to store vesting schedules and beneficiary data
- **Smart Contracts**: **ethers.js** deployer with OpenZeppelin libraries
- **Factory Pattern**: Minimal proxy clones for gas efficiency
- **Alternative**: Same with **FastAPI** deployer for Python preference

### Core Components

1. **Factory Contract**: Main deployment and configuration logic
2. **Token Template**: Upgradeable ERC20 implementation
3. **Vesting Contract**: Time-based token release logic
4. **Frontend Application**: UI for deployment and management
5. **Deployment Scripts**: Automated deployment and verification
6. **Management Dashboard**: Token and vesting administration

### Vesting Types

- **Cliff Vesting**: All tokens released at specific date
- **Linear Vesting**: Gradual release over time period
- **Cliff + Linear**: Combination of both mechanisms
- **Custom Schedules**: Flexible configuration options

## Deliverables

### 1. Smart Contract System

- [ ]  Factory contract for token + vesting deployment
- [ ]  ERC20 token template with allocation support
- [ ]  Vesting contract with cliff and linear schedules
- [ ]  Minimal proxy implementation for gas efficiency

### 2. Vesting Mechanisms

- [ ]  Cliff vesting implementation (all-or-nothing release)
- [ ]  Linear vesting implementation (gradual release)
- [ ]  Combined cliff + linear vesting schedules
- [ ]  Multiple beneficiary support with individual schedules

### 3. Frontend Application

- [ ]  Token deployment configuration interface
- [ ]  Vesting schedule setup and management
- [ ]  Beneficiary dashboard for claiming tokens
- [ ]  Project management and analytics interface

### 4. Batch Operations

- [ ]  Batch deployment scripts for multiple projects
- [ ]  CSV import/export for beneficiary management
- [ ]  Launchpad integration for project launches
- [ ]  Mass token distribution capabilities

### 5. Documentation & Testing

- [ ]  Comprehensive setup and deployment guide
- [ ]  Smart contract documentation and examples
- [ ]  Frontend user guide and tutorials
- [ ]  Test suite with 80%+ coverage including time-based tests

### 6. Management Tools

- [ ]  Admin interface for factory management
- [ ]  Token analytics and distribution tracking
- [ ]  Vesting progress monitoring and reporting
- [ ]  Emergency controls and security features

## Acceptance Criteria

### Functional Requirements

- ✅ Deploys ERC20 token and vesting contracts in single transaction
- ✅ Supports cliff, linear, and combined vesting schedules
- ✅ Handles multiple beneficiaries with different schedules
- ✅ Provides user-friendly interface for deployment and management
- ✅ Includes batch operations for large-scale deployments
- ✅ Implements proper token claiming and distribution logic

### Technical Requirements

- ✅ Uses minimal proxy pattern for gas-efficient deployments
- ✅ Integrates with Conflux eSpace mainnet and testnet
- ✅ Implements OpenZeppelin security standards
- ✅ Handles time-based operations correctly
- ✅ Provides comprehensive error handling

### Quality Requirements

- ✅ 80% minimum test coverage including time manipulation
- ✅ Clean, secure Solidity code following best practices
- ✅ User-friendly interface with responsive design
- ✅ Comprehensive documentation for all features
- ✅ Gas-optimized contract implementations

## Example User Flows

### Token Launch with Team Vesting

1. **Founder accesses deployment interface**
2. **Configures token**: "MyProject Token (MPT), 10M supply"
3. **Sets initial distribution**: 60% public, 30% team, 10% advisors
4. **Configures team vesting**: 6-month cliff, 18-month linear
5. **Adds team members**: CSV upload with addresses and amounts
6. **Deploys contracts** in single transaction
7. **Team members can claim** tokens according to schedule

### Investor Distribution Setup

1. **Project creates new deployment** with investor allocations
2. **Configures investor vesting**: 3-month cliff, 9-month linear
3. **Uploads investor list** with addresses and investment amounts
4. **Deploys token with vesting** for automatic distribution
5. **Investors connect wallets** to claim vested tokens
6. **Dashboard shows** real-time vesting progress

### Launchpad Integration

1. **Launchpad admin uses batch deployment**
2. **Loads project configurations** from JSON/CSV files
3. **Deploys multiple tokens** with respective vesting schedules
4. **Configures project dashboards** for each token
5. **Investors can track** and claim from multiple projects
6. **Analytics dashboard** shows portfolio performance

## Technical Specifications

### Environment Variables

```
CONFLUX_RPC_URL=https://evm.confluxrpc.com
CONFLUX_TESTNET_RPC_URL=https://evmtestnet.confluxrpc.com
DEPLOYER_PRIVATE_KEY=0x...
FACTORY_ADMIN_ADDRESS=0x...
CONFLUXSCAN_API_KEY=<verification_key>
NEXT_PUBLIC_FACTORY_ADDRESS=0x...
NEXT_PUBLIC_CHAIN_ID=1030

```

### Smart Contract Architecture

```solidity
// Factory contract for deployment
contract TokenVestingFactory {
    struct TokenConfig {
        string name;
        string symbol;
        uint256 totalSupply;
        address owner;
    }

    struct VestingConfig {
        address beneficiary;
        uint256 amount;
        uint256 cliff;
        uint256 duration;
        bool revocable;
    }

    function deployTokenWithVesting(
        TokenConfig memory tokenConfig,
        VestingConfig[] memory vestingConfigs
    ) external returns (address token, address[] memory vestingContracts);
}

// Vesting contract template
contract TokenVesting {
    uint256 public cliff;
    uint256 public duration;
    uint256 public start;
    uint256 public released;
    bool public revocable;

    function release() external;
    function revoke() external onlyOwner;
    function vestedAmount() public view returns (uint256);
}

// ERC20 token template
contract VestedToken is ERC20, Ownable {
    mapping(address => uint256) public vestedBalances;

    function mintWithVesting(
        address to,
        uint256 amount,
        address vestingContract
    ) external onlyOwner;
}

```

### Database Schema (Frontend)

```sql
-- Deployed tokens
CREATE TABLE deployed_tokens (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  total_supply VARCHAR(78) NOT NULL,
  owner_address VARCHAR(42) NOT NULL,
  factory_tx_hash VARCHAR(66) NOT NULL,
  deployed_at TIMESTAMP DEFAULT NOW()
);

-- Vesting schedules
CREATE TABLE vesting_schedules (
  id SERIAL PRIMARY KEY,
  token_id INTEGER REFERENCES deployed_tokens(id),
  contract_address VARCHAR(42) NOT NULL,
  beneficiary_address VARCHAR(42) NOT NULL,
  total_amount VARCHAR(78) NOT NULL,
  cliff_duration INTEGER NOT NULL, -- seconds
  vesting_duration INTEGER NOT NULL, -- seconds
  start_time TIMESTAMP NOT NULL,
  released_amount VARCHAR(78) DEFAULT '0',
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Beneficiary claims
CREATE TABLE vesting_claims (
  id SERIAL PRIMARY KEY,
  vesting_schedule_id INTEGER REFERENCES vesting_schedules(id),
  amount_claimed VARCHAR(78) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  claimed_at TIMESTAMP DEFAULT NOW()
);

```

### Deployment Configuration Format

```json
{
  "token": {
    "name": "MyProject Token",
    "symbol": "MPT",
    "totalSupply": "10000000000000000000000000", // 10M tokens
    "decimals": 18
  },
  "allocations": [
    {
      "category": "team",
      "percentage": 30,
      "vesting": {
        "cliff": 15768000, // 6 months in seconds
        "duration": 47304000, // 18 months total
        "revocable": true
      }
    },
    {
      "category": "investors",
      "percentage": 40,
      "vesting": {
        "cliff": 7884000, // 3 months
        "duration": 23652000, // 9 months total
        "revocable": false
      }
    }
  ],
  "beneficiaries": [
    {
      "address": "0x123...",
      "category": "team",
      "amount": "500000000000000000000000" // 500k tokens
    }
  ]
}

```

### API Endpoints

- `POST /api/deploy` - Deploy new token with vesting
- `GET /api/tokens/:address` - Get token information and vesting details
- `GET /api/vesting/:address` - Get vesting schedule for beneficiary
- `POST /api/claim` - Claim vested tokens
- `GET /api/analytics/:tokenAddress` - Get token distribution analytics
- `POST /api/batch/deploy` - Batch deploy multiple tokens
- `POST /api/beneficiaries/import` - Import beneficiaries from CSV

## Bonus Features (Optional)

### Advanced Vesting Features

- Milestone-based vesting (unlock on specific achievements)
- Performance-based vesting with external oracles
- Token buyback and burn mechanisms
- Dynamic vesting schedule modifications

### Enhanced Management

- Multi-signature approval for vesting changes
- Automated compliance reporting
- Integration with tax reporting tools
- KYC/AML integration for beneficiaries

### Launchpad Features

- Whitelist management for token sales
- Automated liquidity pool creation
- Token price discovery mechanisms
- Community governance for project approval

## Evaluation Criteria

### Code Quality (30%)

- Clean, secure Solidity code with best practices
- Gas optimization and efficient contract design
- Proper error handling and validation
- Comprehensive test coverage

### Functionality (35%)

- Factory deployment correctness and reliability
- Vesting logic accuracy and time handling
- Frontend usability and feature completeness
- Batch operations effectiveness

### Security (25%)

- Smart contract security best practices
- Access control and permission management
- Reentrancy and overflow protection
- Emergency controls and recovery mechanisms

### Documentation (10%)

- Clear deployment and usage instructions
- Smart contract documentation
- User guide and tutorials
- Technical architecture documentation

## Security Considerations

### Smart Contract Security

- Reentrancy guards on critical functions
- Overflow/underflow protection
- Access control for admin functions
- Emergency pause mechanisms

### Vesting Security

- Time manipulation resistance
- Proper beneficiary validation
- Revocation controls and limitations
- Claim verification and limits

### Factory Security

- Deployment parameter validation
- Owner privilege limitations
- Upgrade mechanisms and governance
- Gas limit considerations

## Resources

### Conflux Documentation

- [Conflux eSpace Guide](https://doc.confluxnetwork.org/docs/espace/)
- [Smart Contract Development](https://doc.confluxnetwork.org/docs/espace/DevelopmentGuide)
- [Token Standards on eSpace](https://doc.confluxnetwork.org/docs/espace/UserGuide)

### Smart Contract Development

- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts/)
- [OpenZeppelin Vesting](https://docs.openzeppelin.com/contracts/4.x/vesting)
- [Minimal Proxy Standard (EIP-1167)](https://eips.ethereum.org/EIPS/eip-1167)
- [Factory Pattern Best Practices](https://docs.openzeppelin.com/contracts/4.x/factory)

### Development Tools

- [Hardhat Documentation](https://hardhat.org/docs)
- [ethers.js Documentation](https://docs.ethers.org/)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [Hardhat Time Helpers](https://hardhat.org/hardhat-network/docs/reference#hardhat_mine)

### Vesting and Tokenomics

- [Token Vesting Best Practices](https://blog.openzeppelin.com/vesting-contracts-best-practices/)
- [ERC20 Security Considerations](https://consensys.github.io/smart-contract-best-practices/)
- [Tokenomics Design Patterns](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/)

---

**Ready to simplify token launches with smart vesting?** Comment `/claim` on the GitHub issue to get started!