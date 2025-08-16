# Bounty #04: Conflux eSpace MCP Server (EVM Read/Write, MCP-first)

## Overview

**Reward**: $1,800

**Difficulty**: 🔴 Large

**Timeline**: 4-5 weeks

**Type**: Infrastructure, MCP Server, EVM (Conflux eSpace)

## Problem Statement

AI agents need a consistent, MCP-native way to read and write data on Conflux eSpace. Typical explorer APIs are not optimized for MCP flows, and raw RPC can be hard for agents to use without well-defined tools, resources, and schemas.

## Solution Overview

Build a Model Context Protocol (MCP) server for Conflux eSpace that exposes a robust set of EVM tools and resources for AI agents. The primary interface is MCP (stdio and SSE). The server should support both read and write operations, with client-supplied private keys used only in-memory for signing and never persisted.

## Core Features

### 1. MCP Protocol Implementation (Required)

- Full MCP server using `@modelcontextprotocol/sdk`
- MCP stdio mode and HTTP SSE transport
- Resource discovery and capability advertisement (tools/resources/prompts)
- Tool execution and JSON output with bigint-safe formatting

### 2. EVM Read/Write for Conflux eSpace (Required)

- Read: chain info, blocks, transactions, balances, ERC20/721/1155 data
- Write: native transfers, ERC20 transfers/approvals, ERC721/1155 transfers, generic contract writes
- Contract reads and writes with supplied ABI and arguments
- Client supplies private key; keys are not stored or logged

### 3. Documentation (Required)

- Clear README with setup, environment variables, examples for Cursor/Claude
- Tool and resource listings with sample inputs/outputs
- Health check endpoint

### 4. Optional HTTP Facade and Docs (Bonus)

- Optional REST facade mirroring key MCP read endpoints
- Optional OpenAPI 3.0 spec and Swagger UI
- Optional Postman collection

### 5. Optional Enrichment via ConfluxScan (Bonus)

- Optional ConfluxScan client for token holders/distribution, transfer history, contract verification/source
- Optional normalization, retry/backoff, caching, and rate limiting

## Technical Requirements

### Architecture

- **Server Framework**: **Express 4** or **Fastify 5** (examples assume Express)
- **Language**: **TypeScript**
- **MCP Protocol**: Official MCP SDK implementation
- **EVM Integration**: via `viem` against Conflux eSpace mainnet and testnet
- **Docs**: README required; OpenAPI/Swagger optional (bonus)
- **Caching/Rate Limiting**: optional (bonus)

### Core Components

1. **MCP Server Core**: Protocol implementation, tools/resources/prompts
2. **EVM Services**: `viem`-based clients for reads/writes and formatting utilities
3. **HTTP SSE Server**: Optional transport for MCP over HTTP
4. **(Bonus) REST + Docs**: Optional REST facade, OpenAPI, Swagger UI
5. **(Bonus) ConfluxScan Client**: Optional enrichment, normalization, caching

### MCP Resources

Use the `evm://{network}/...` URI scheme for consistency with EVM MCP servers. At minimum:

- `evm://{network}/chain` – network, chainId, current block, RPC URL
- `evm://{network}/block/{blockNumber}` – block by number
- `evm://{network}/block/hash/{blockHash}` – block by hash
- `evm://{network}/block/latest` and `evm://block/latest` – latest block (default network)
- `evm://{network}/tx/{txHash}` and `evm://tx/{txHash}` – transaction details
- `evm://{network}/address/{address}/balance` – native balance
- `evm://{network}/token/{tokenAddress}` – ERC20 token info
- `evm://{network}/token/{tokenAddress}/balanceOf/{address}` – ERC20 balance
- `evm://{network}/nft/{tokenAddress}/{tokenId}` – ERC721 token info
- `evm://{network}/nft/{tokenAddress}/{tokenId}/isOwnedBy/{address}` – ERC721 ownership
- `evm://{network}/erc1155/{tokenAddress}/{tokenId}/uri` – ERC1155 URI
- `evm://{network}/erc1155/{tokenAddress}/{tokenId}/balanceOf/{address}` – ERC1155 balance

## Deliverables

### 1. MCP Server (Required)

- [ ] Full MCP server with stdio and HTTP SSE transport
- [ ] Tools/resources/prompts registration with capabilities and schemas
- [ ] EVM reads and writes for Conflux eSpace mainnet/testnet via `viem`
- [ ] Health check endpoint

### 2. Documentation (Required)

- [ ] README with setup, environment, examples (Cursor/Claude), and tool/resource catalog

### 3. Testing and Docker (Required)

- [ ] Unit tests for core services and tools; runnable test script
- [ ] Dockerfile, docker-compose, and working health check

### 4. Optional Enhancements (Bonus)

- [ ] REST facade + OpenAPI 3.0 spec + Swagger UI + Postman collection
- [ ] ConfluxScan enrichment client with normalization, retry/backoff
- [ ] Caching (Redis or equivalent) and rate limiting
- [ ] Compression, pagination envelopes, request batching
- [ ] Monitoring/metrics

## Acceptance Criteria

### Functional (Required)

- ✅ Implements MCP protocol with stdio and SSE transports
- ✅ Provides the required EVM read/write tools and resources listed below
- ✅ Returns consistent JSON with bigint-safe formatting
- ✅ Proper error messages when private key is missing for write ops
- ✅ Health endpoint responds with server status

### Technical (Required)

- ✅ TypeScript codebase using `@modelcontextprotocol/sdk` and `viem`
- ✅ Proper error handling; no private keys are stored or logged
- ✅ Dockerized with working health check

### Quality (Required)

- ✅ Unit tests for core services/tools; tests pass in CI/local
- ✅ Clear README with examples and client configuration

### Bonus

- ✅ REST facade with OpenAPI/Swagger/Postman
- ✅ ConfluxScan enrichment with normalization/caching/rate limiting
- ✅ Pagination, compression, batching
- ✅ Monitoring/metrics endpoints

## MCP Resource Examples

### Contract Resource

```json
{
  "uri": "evm://conflux/token/0x123...",
  "name": "Smart Contract Details",
  "description": "Detailed information about a smart contract",
  "mimeType": "application/json"
}

```

### Token Resource

```json
{
  "uri": "evm://conflux/token/0x456.../balanceOf/0xOwner...",
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

## Tooling and Resources (Required)

### Supported Networks

- `conflux` (mainnet, chainId 1030)
- `conflux-testnet` (testnet, chainId 71)

### Tools (must be implemented)

- Network: `get_supported_networks`, `get_chain_info`
- Blocks/Tx: `get_block_by_number`, `get_latest_block`, `get_transaction`, `get_transaction_receipt`, `estimate_gas`
- Balances/Tokens: `get_balance`, `get_erc20_balance`, `get_token_info`, `get_nft_info`, `get_erc1155_token_uri`, `get_nft_balance`, `get_erc1155_balance`
- Contracts: `read_contract`, `write_contract`, `is_contract`
- Transfers: `transfer_conflux`, `transfer_erc20`, `approve_token_spending`, `transfer_nft`, `transfer_erc1155`
- Wallet: `get_address_from_private_key`

Note: Additional overlapping helpers like `get_token_balance`, `get_token_balance_erc20`, and `transfer_token` MAY be provided and are acceptable.

## Technical Specifications

### Environment Variables

```text
MCP_SERVER_PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info
PRIVATE_KEY=<optional, used only for signing in-memory>

# Bonus (if REST/ConfluxScan/caching included)
CONFLUXSCAN_API_URL=https://api.confluxscan.net
CONFLUXSCAN_API_KEY=<optional_api_key>
REDIS_URL=<optional_redis_connection>
CACHE_TTL=300
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

### Project Structure (example)

```text
src/
├── core/
│   ├── chains.ts           # chain maps and helpers
│   ├── config.ts           # runtime config and key handling
│   ├── prompts.ts          # MCP prompts
│   ├── resources.ts        # MCP resources (evm://...)
│   ├── tools.ts            # MCP tools
│   └── services/           # viem-based services (blocks, tx, tokens, transfers)
├── server/
│   ├── server.ts           # MCP server setup
│   └── http-server.ts      # HTTP SSE transport and health
└── tests/                  # unit tests

# Bonus (if included):
src/services/confluxscan.ts
src/services/cache.ts
src/middleware/*
src/routes/*
src/docs/openapi.yaml
src/docs/postman.json
```

### Package Dependencies (baseline)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.7.0",
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "viem": "^2.23.0",
    "zod": "^3.24.0"
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

- [Conflux eSpace Guide](https://doc.confluxnetwork.org/docs/espace/)
- [Conflux RPC Documentation](https://doc.confluxnetwork.org/docs/core/build/json-rpc/)
- (Bonus) [ConfluxScan API Documentation](https://doc.confluxnetwork.org/docs/espace/UserGuide/#confluxscan)

### Development Tools

- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- (Bonus) [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- (Bonus) [Redis Documentation](https://redis.io/docs/)

---

**Ready to build the future of blockchain data access?** Comment `/claim` on the GitHub issue to get started!