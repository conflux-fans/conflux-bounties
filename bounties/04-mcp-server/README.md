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

### Network Operations
- `get_supported_networks` - List available networks
- `get_chain_info` - Get chain ID, block number, RPC info
- `get_chain_id` - Get current chain ID

### Balance Operations
- `get_balance` - Get native Conflux balance
- `get_erc20_balance` - Get ERC20 token balance
- `get_erc721_balance` - Get NFT balance
- `get_erc1155_balance` - Get ERC1155 token balance

### Transaction Operations
- `transfer_conflux` - Transfer Conflux tokens
- `transfer_erc20` - Transfer ERC20 tokens
- `transfer_erc721` - Transfer NFTs
- `transfer_erc1155` - Transfer ERC1155 tokens

### Block & Transaction Data
- `get_latest_block` - Get latest block info
- `get_block_by_number` - Get specific block
- `get_transaction` - Get transaction details
- `get_transaction_receipt` - Get transaction receipt

### Smart Contracts
- `read_contract` - Call view/pure contract functions
- `write_contract` - Execute state-changing contract functions
- `is_contract` - Check if address is contract

### Gas & Fees
- `estimate_gas` - Estimate transaction gas

### Advanced
- `get_address_from_private_key` - Derive address from key

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
// Returns: { address, network, wei, cfx }
```

### Send Transaction
```javascript
const result = await client.call("transfer_native", {
  to: "0x...",
  amount: "0.01",
  network: "conflux-testnet"
});
// Returns: { transactionHash, to, amount, network, status }
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
