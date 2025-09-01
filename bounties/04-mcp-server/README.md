# 🌊 Conflux MCP Server

> **Model Context Protocol (MCP)** server for Conflux blockchain operations

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue.svg)](https://www.typescriptlang.org/)

A powerful MCP server that enables AI assistants to interact with the Conflux blockchain. Supports both HTTP/SSE and STDIO transport modes for seamless integration with Cursor IDE, Claude Desktop, and any MCP-compatible client.

## ✨ Features

- 🔗 **Universal MCP Support** - Works with Cursor IDE, Claude Desktop, and any MCP client
- 🔐 **Client-Side Security** - Private keys provided by clients, never stored on server
- 🌐 **Multi-Network** - Supports Conflux mainnet and testnet
- 🛠️ **27 Blockchain Tools** - Complete toolkit for Conflux operations
- 🐳 **Docker Ready** - Production-ready containerization
- 📡 **Real-time** - Server-Sent Events for live communication

## 🚀 Quick Start

### One-Command Setup

**Mac/Linux:**
```bash
./start.sh
```

**Windows:**
```powershell
.\start.ps1
```

> 🎯 **This single command does everything:** setup, build, and run automatically!

### Manual Setup

```bash
# Install dependencies
bun install

# Build the project
bun run build
bun run build:http

# Start the server
bun run start:http
```

### Docker Setup

```bash
# Build and run with Docker
docker-compose up -d

# Or run directly
docker run -d --name conflux-mcp-server -p 3333:3333 conflux-mcp-server:latest
```

## 🔧 MCP Client Configuration Examples

### Docker - stdio

```json
{
  "mcpServers": {
    "conflux-mcp-server": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "MCP_MODE=stdio",
        "conflux-mcp-server:latest"
      ],
      "env": {
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### HTTP - sse

```json
{
  "mcpServers": {
    "conflux-mcp-server": {
      "url": "http://localhost:3333/sse",
      "headers": {
        "X-Private-Key": "0x..."
      }
    }
  }
}
```

## 🛠️ Available Tools

The server registers 27 tools. Names and categories below match the implementation exactly.

### Network
- `get_supported_networks` - List available networks
- `get_chain_info` - Get chain ID, latest block number, and RPC URL for a network

### Blocks and Transactions
- `get_block_by_number` - Get a block by number
- `get_latest_block` - Get latest block
- `get_transaction` - Get transaction details
- `get_transaction_receipt` - Get transaction receipt

### Balances
- `get_balance` - Get native balance (wei and ether)
- `get_erc20_balance` - Get ERC20 balance for address
- `get_token_balance` - Get ERC20 balance (tokenAddress + ownerAddress)
- `get_token_balance_erc20` - Get ERC20 balance (address + tokenAddress)
- `get_nft_balance` - Get ERC721 balance (count of tokens owned in a collection)
- `get_erc1155_balance` - Get ERC1155 balance for a tokenId

### Transfers and Approvals
- `transfer_conflux` - Transfer native tokens
- `transfer_erc20` - Transfer ERC20 tokens
- `transfer_token` - Transfer ERC20 tokens (alias with different args)
- `approve_token_spending` - Approve ERC20 spending
- `transfer_nft` - Transfer ERC721
- `transfer_erc1155` - Transfer ERC1155

### Contracts
- `read_contract` - Call a view/pure function
- `write_contract` - Send a state-changing transaction
- `is_contract` - Check whether an address is a contract

### Gas & Fees
- `estimate_gas` - Estimate transaction gas

### Tokens and NFTs
- `get_token_info` - ERC20 metadata
- `get_nft_info` - ERC721 metadata
- `check_nft_ownership` - Check if address owns an ERC721 tokenId
- `get_erc1155_token_uri` - ERC1155 token URI

### Wallet
- `get_address_from_private_key` - Derive address from PRIVATE_KEY env

## 🌐 Supported Networks

| Network | Chain ID | Description |
|---------|----------|-------------|
| `conflux` | 1030 | Conflux Mainnet |
| `conflux-testnet` | 71 | Conflux Testnet |

## 🔐 Security Model

### Private Key Management
- ✅ **Client-Side**: Private keys provided by MCP client
- ✅ **Per-Request**: Each request includes the private key securely
- ✅ **No Server Storage**: Server doesn't store private keys
- ✅ **Multi-Client**: Different clients can use different keys

## 🐳 Docker Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3333 |
| `HOST` | Bind address | 0.0.0.0 |
| `NODE_ENV` | Environment | production |
| `LOG_LEVEL` | Logging level | info |

### Health Check

```bash
# Test server health
curl http://localhost:3333/health
```

## 📊 Server Endpoints

- `GET /sse` - Server-Sent Events endpoint
- `POST /messages` - MCP message handling
- `GET /health` - Health check endpoint

## 🧪 Testing

```bash
# Run tests
bun test

# Test network connectivity
curl http://localhost:3333/health
```

## 📚 Examples

### Get Supported Networks
```javascript
const networks = await client.call("get_supported_networks");
// Returns: ["conflux", "conflux-testnet"]
```

### Check Balance
```javascript
const balance = await client.call("get_balance", {
  address: "0x...",
  network: "conflux-testnet"
});
// Returns: { address, network, wei, ether }
```

### Send Transaction
```javascript
const result = await client.call("transfer_conflux", {
  to: "0x...",
  amount: "0.01",
  network: "conflux-testnet"
});
// Returns: { success, txHash, to, amount, network }
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/conflux-protocol/conflux-mcp-server/issues)
- **Health Check**: `curl http://localhost:3333/health`
- **Documentation**: See `docs/` directory

---

**Ready to use Conflux blockchain operations in any MCP client! 🚀**

## 📦 MCP Resources

These HTTP resources are registered and available via MCP resource URIs. Replace placeholders with actual values.

- evm://{network}/chain
  - Example: evm://conflux/chain
  - Sample output:
    {
      "network": "conflux",
      "chainId": 1030,
      "blockNumber": "14234567",
      "rpcUrl": "https://evm.confluxrpc.com"
    }

- evm://{network}/block/{number}
  - Example: evm://conflux/block/14230000
  - Sample output (truncated block object):
    {
      "hash": "0x...",
      "number": "14230000",
      "timestamp": "1724892000",
      "miner": "0x...",
      "transactions": [
        "0x..."
      ]
    }

- evm://{network}/block/hash/{hash}
  - Example: evm://conflux/block/hash/0xabc123...
  - Sample output (truncated block object):
    {
      "hash": "0xabc123...",
      "number": "14230000",
      "timestamp": "1724892000",
      "miner": "0x...",
      "transactions": [
        "0x..."
      ]
    }

- evm://{network}/block/latest
  - Example: evm://conflux/block/latest
  - Sample output (truncated block object):
    {
      "hash": "0x...",
      "number": "14234567",
      "timestamp": "1724899999",
      "miner": "0x...",
      "transactions": [
        "0x..."
      ]
    }

- evm://{network}/tx/{hash}
  - Example: evm://conflux/tx/0xdeadbeef...
  - Sample output (truncated transaction object):
    {
      "hash": "0xdeadbeef...",
      "from": "0x...",
      "to": "0x...",
      "value": "1000000000000000000",
      "nonce": "123",
      "blockNumber": "14230000"
    }

- evm://{network}/address/{address}/balance
  - Example: evm://conflux/address/0x1234567890123456789012345678901234567890/balance
  - Sample output:
    {
      "network": "conflux",
      "address": "0x1234567890123456789012345678901234567890",
      "balance": {
        "wei": "1000000000000000000",
        "ether": "1.0"
      }
    }

- evm://{network}/token/{tokenAddress}
  - Example: evm://conflux/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
  - Sample output:
    {
      "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "network": "conflux",
      "name": "USD Coin",
      "symbol": "USDC",
      "decimals": 6,
      "totalSupply": "123456789000000"
    }

- evm://{network}/token/{tokenAddress}/balanceOf/{address}
  - Example: evm://conflux/token/0xA0b8.../balanceOf/0x1234...
  - Sample output:
    {
      "tokenAddress": "0xA0b8...",
      "owner": "0x1234...",
      "network": "conflux",
      "raw": "25000000",
      "formatted": "25",
      "symbol": "USDC",
      "decimals": 6
    }

- evm://{network}/nft/{tokenAddress}/{tokenId}
  - Example: evm://conflux/nft/0xBC4C.../1234
  - Sample output (metadata fields vary by collection):
    {
      "contract": "0xBC4C...",
      "tokenId": "1234",
      "network": "conflux",
      "name": "BAYC #1234",
      "symbol": "BAYC",
      "tokenURI": "ipfs://...",
      "owner": "0xdeadbeef..."
    }

- evm://{network}/nft/{tokenAddress}/{tokenId}/isOwnedBy/{address}
  - Example: evm://conflux/nft/0xBC4C.../1234/isOwnedBy/0x1234...
  - Sample output:
    {
      "contract": "0xBC4C...",
      "tokenId": "1234",
      "owner": "0x1234...",
      "network": "conflux",
      "isOwner": true
    }

- evm://{network}/erc1155/{tokenAddress}/{tokenId}/uri
  - Example: evm://conflux/erc1155/0x5B6D.../42/uri
  - Sample output:
    {
      "contract": "0x5B6D...",
      "tokenId": "42",
      "network": "conflux",
      "uri": "ipfs://..."
    }

- evm://{network}/erc1155/{tokenAddress}/{tokenId}/balanceOf/{address}
  - Example: evm://conflux/erc1155/0x5B6D.../42/balanceOf/0x1234...
  - Sample output:
    {
      "contract": "0x5B6D...",
      "tokenId": "42",
      "owner": "0x1234...",
      "network": "conflux",
      "balance": "3"
    }

## 🔍 Additional Examples

### Get ERC20 Balance
```javascript
const result = await client.call("get_erc20_balance", {
  address: "0x...",
  tokenAddress: "0xA0b8...",
  network: "conflux"
});
// Returns: {
//   "address": "0x...",
//   "tokenAddress": "0xA0b8...",
//   "network": "conflux",
//   "balance": { "raw": "25000000", "formatted": "25", "decimals": 6 }
// }
```

### Read Contract
```javascript
const result = await client.call("read_contract", {
  contractAddress: "0xA0b8...",
  abi: [{"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"type":"uint256"}],"stateMutability":"view","type":"function"}],
  functionName: "balanceOf",
  args: ["0x1234..."],
  network: "conflux"
});
// Returns: "25000000"
```

### Write Contract
```javascript
const result = await client.call("write_contract", {
  contractAddress: "0xA0b8...",
  abi: [{"inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"type":"bool"}],"stateMutability":"nonpayable","type":"function"}],
  functionName: "transfer",
  args: ["0x5678...", "1000000"],
  network: "conflux"
});
// Returns: { "network": "conflux", "transactionHash": "0x...", "message": "Contract write transaction sent successfully" }
```
