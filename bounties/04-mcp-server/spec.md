# Bounty #04: Conflux MCP Server (eSpace Read-Only Wrapper)

## Overview

**Reward**: $1,800

**Difficulty**: 🔴 Large

**Timeline**: 4-5 weeks

**Type**: Infrastructure, API Server, MCP Protocol

## Problem Statement

AI agents and applications need structured, reliable access to Conflux eSpace blockchain data, but ConfluxScan APIs can be complex and inconsistent for AI consumption. There's a need for a simplified, standardized API that wraps ConfluxScan and provides clean, normalized data endpoints specifically designed for AI agents and modern applications.

## Solution Overview

Create a lightweight Model Context Protocol (MCP) server using Express.js or Koa.js that wraps ConfluxScan APIs and provides simplified, normalized endpoints for accessing contract metadata, token information, transaction history, and account data. The server should include comprehensive OpenAPI documentation and be optimized for AI agent consumption.

## Core Features

### 1. MCP Protocol Implementation

- Full Model Context Protocol server implementation
- Standard MCP endpoints and resource management
- Resource discovery and capability advertisement
- Tool execution and response formatting

### 2. ConfluxScan API Wrapper

- Unified interface to ConfluxScan APIs
- Data normalization and standardization
- Rate limiting and caching for performance
- Error handling and retry logic

### 3. Contract Data Access

- Contract metadata retrieval and formatting
- ABI parsing and method information
- Contract verification status and source code
- Contract creation and deployment information

### 4. Token Information

- Token holder lists and distribution
- Token supply and circulation data
- Token transfer history and analytics
- Token metadata and contract information

### 5. Transaction and Account Data

- Transaction history with detailed information
- Account balance and transaction analytics
- Block information and network statistics
- Address activity and interaction patterns

### 6. API Documentation

- Comprehensive OpenAPI/Swagger documentation
- Postman collection for easy testing
- Example requests and responses
- Integration guides for common use cases

## Technical Requirements

### Architecture

- **Server Framework**: **Fastify 5** (recommended for low-latency, minimal runtime footprint)
- **Language**: **TypeScript** for type safety and better maintainability
- **MCP Protocol**: Official MCP SDK implementation
- **API Integration**: ConfluxScan API wrapper with enhanced error handling
- **Caching**: **Redis** cache for performance optimization
- **Documentation**: **OpenAPI 3.0** auto-docs generation
- **Alternative**: **FastAPI** (pydantic models) for Python preference

### Core Components

1. **MCP Server Core**: Protocol implementation and resource management
2. **ConfluxScan Client**: API wrapper with rate limiting and caching
3. **Data Normalizer**: Consistent data formatting and validation
4. **Resource Manager**: MCP resource discovery and management
5. **Tool Handler**: MCP tool execution and response formatting
6. **Documentation Generator**: OpenAPI spec and Swagger UI

### API Endpoints (MCP Resources)

- **Contracts**: Contract metadata, ABI, and verification info
- **Tokens**: Token data, holders, and transfer history
- **Accounts**: Account balances, transactions, and activity
- **Transactions**: Transaction details and history
- **Blocks**: Block information and statistics
- **Network**: Network stats and health information

## Deliverables

### 1. MCP Server Implementation

- [ ]  Full MCP protocol server implementation
- [ ]  Resource discovery and management
- [ ]  Tool execution framework
- [ ]  Standard MCP endpoints and responses

### 2. ConfluxScan Integration

- [ ]  Complete ConfluxScan API wrapper
- [ ]  Rate limiting and retry logic
- [ ]  Response caching system
- [ ]  Error handling and logging

### 3. Data Access Endpoints

- [ ]  Contract metadata and ABI endpoints
- [ ]  Token information and holder data
- [ ]  Transaction history and details
- [ ]  Account balance and activity data

### 4. Performance Optimization

- [ ]  Redis caching implementation (optional)
- [ ]  Request batching and optimization
- [ ]  Response compression and pagination
- [ ]  Performance monitoring and metrics

### 5. Documentation and Testing

- [ ]  Comprehensive OpenAPI 3.0 specification
- [ ]  Swagger UI for interactive testing
- [ ]  Postman collection with examples
- [ ]  Integration guide and tutorials

### 6. Deployment and Quality

- [ ]  Docker containerization
- [ ]  Environment configuration management
- [ ]  Health check endpoints
- [ ]  Unit and integration tests (80%+ coverage)

## Acceptance Criteria

### Functional Requirements

- ✅ Implements complete MCP protocol specification
- ✅ Provides normalized access to all major ConfluxScan data
- ✅ Handles rate limiting and API errors gracefully
- ✅ Returns consistent, well-formatted JSON responses
- ✅ Supports pagination for large data sets
- ✅ Includes comprehensive API documentation

### Technical Requirements

- ✅ Built with TypeScript for type safety
- ✅ Implements proper error handling and logging
- ✅ Includes caching for performance optimization
- ✅ Provides health check and monitoring endpoints
- ✅ Docker deployment ready

### Quality Requirements

- ✅ 80% minimum test coverage
- ✅ Clean, maintainable code with proper documentation
- ✅ Performance optimized for concurrent requests
- ✅ Comprehensive OpenAPI documentation
- ✅ Production-ready error handling

## MCP Resource Examples

### Contract Resource

```json
{
  "uri": "conflux://contracts/0x123...",
  "name": "Smart Contract Details",
  "description": "Detailed information about a smart contract",
  "mimeType": "application/json"
}

```

### Token Resource

```json
{
  "uri": "conflux://tokens/0x456.../holders",
  "name": "Token Holders",
  "description": "List of token holders and their balances",
  "mimeType": "application/json"
}

```

### Tools Available

- `get_contract_info` - Retrieve contract metadata and ABI
- `get_token_holders` - Get token holder distribution
- `get_transaction_history` - Fetch transaction history for address
- `get_account_balance` - Get account balance and token holdings
- `search_contracts` - Search for contracts by various criteria

## API Endpoint Examples

### Contract Information

```
GET /mcp/resources/contracts/{address}

```

Response:

```json
{
  "address": "0x123...",
  "name": "MyToken",
  "verified": true,
  "abi": [...],
  "sourceCode": "contract MyToken {...}",
  "compiler": "0.8.19",
  "createdAt": "2025-01-01T00:00:00Z"
}

```

### Token Holders

```
GET /mcp/resources/tokens/{address}/holders

```

Response:

```json
{
  "token": {
    "address": "0x456...",
    "name": "MyToken",
    "symbol": "MTK",
    "totalSupply": "1000000000000000000000000"
  },
  "holders": [
    {
      "address": "0x789...",
      "balance": "100000000000000000000",
      "percentage": "10.0"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 1500
  }
}

```

### Account Balance

```
GET /mcp/resources/accounts/{address}/balance

```

Response:

```json
{
  "address": "0x789...",
  "balance": {
    "cfx": "1000000000000000000",
    "tokens": [
      {
        "address": "0x456...",
        "name": "MyToken",
        "symbol": "MTK",
        "balance": "100000000000000000000"
      }
    ]
  },
  "lastUpdated": "2025-01-01T12:00:00Z"
}

```

## Technical Specifications

### Environment Variables

```
PORT=3000
CONFLUXSCAN_API_URL=https://api.confluxscan.net
CONFLUXSCAN_API_KEY=<optional_api_key>
REDIS_URL=<optional_redis_connection>
LOG_LEVEL=info
CACHE_TTL=300
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

```

### Project Structure

```
src/
├── mcp/
│   ├── server.ts          # MCP server implementation
│   ├── resources.ts       # Resource definitions and handlers
│   └── tools.ts           # Tool implementations
├── services/
│   ├── confluxscan.ts     # ConfluxScan API client
│   ├── cache.ts           # Caching service
│   └── normalizer.ts      # Data normalization
├── routes/
│   ├── contracts.ts       # Contract endpoints
│   ├── tokens.ts          # Token endpoints
│   └── accounts.ts        # Account endpoints
├── middleware/
│   ├── rateLimit.ts       # Rate limiting
│   ├── cache.ts           # Cache middleware
│   └── error.ts           # Error handling
└── docs/
    ├── openapi.yaml       # OpenAPI specification
    └── postman.json       # Postman collection

```

### Package Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.0",
    "axios": "^1.6.0",
    "redis": "^4.6.0",
    "express-rate-limit": "^7.1.0",
    "swagger-ui-express": "^5.0.0",
    "joi": "^17.11.0",
    "winston": "^3.11.0"
  }
}

```

## Bonus Features (Optional)

### Advanced MCP Features

- Custom resource schemas and validation
- Advanced tool chaining and composition
- Real-time data streaming capabilities
- Multi-network support (Core Space + eSpace)

### Performance Enhancements

- GraphQL-style query optimization
- Database persistence for historical data
- Advanced caching strategies
- Load balancing and clustering

### Integration Features

- Webhook support for real-time updates
- WebSocket connections for live data
- Integration with popular AI frameworks
- SDK generation for multiple languages

## Evaluation Criteria

### Code Quality (25%)

- Clean, maintainable TypeScript code
- Proper error handling and logging
- Comprehensive test coverage
- Performance optimization

### MCP Implementation (30%)

- Correct MCP protocol implementation
- Resource management and discovery
- Tool execution and response formatting
- Standards compliance

### API Design (25%)

- Intuitive and consistent API design
- Proper data normalization
- Comprehensive documentation
- Error handling and validation

### Documentation (20%)

- Clear setup and deployment instructions
- Comprehensive API documentation
- Integration guides and examples
- Code documentation and comments

## Resources

### MCP Protocol

- [Model Context Protocol Specification](https://modelcontextprotocol.io/docs/spec)
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs/sdk)
- [MCP Examples and Tutorials](https://github.com/modelcontextprotocol/examples)

### Conflux Documentation

- [ConfluxScan API Documentation](https://doc.confluxnetwork.org/docs/espace/UserGuide/#confluxscan)
- [Conflux eSpace Guide](https://doc.confluxnetwork.org/docs/espace/)
- [Conflux RPC Documentation](https://doc.confluxnetwork.org/docs/core/build/json-rpc/)

### Development Tools

- [Express.js Documentation](https://expressjs.com/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Redis Documentation](https://redis.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Ready to build the future of blockchain data access?** Comment `/claim` on the GitHub issue to get started!