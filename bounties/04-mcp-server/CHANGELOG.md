# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Conflux MCP Server
- Support for Conflux mainnet and testnet
- 27 blockchain tools for complete Conflux operations
- HTTP/SSE and STDIO transport modes
- Docker containerization
- Comprehensive documentation and examples
- GitHub Actions CI/CD pipeline
- TypeScript implementation with full type safety

### Features
- **Network Operations**: Get supported networks, chain info, chain ID
- **Balance Operations**: Native CFX, ERC20, ERC721, ERC1155 balances
- **Transaction Operations**: Transfer native tokens, ERC20, ERC721, ERC1155
- **Block & Transaction Data**: Latest blocks, transaction details, receipts
- **Smart Contracts**: Deploy, call, read storage, get code
- **Gas & Fees**: Estimate gas, get gas price, nonce management
- **Advanced**: Event logs, transaction simulation, address derivation

### Security
- Client-side private key management
- No server-side key storage
- Per-request authentication
- Multi-client support

## [1.0.0] - 2025-01-29

### Added
- Initial release
- Complete MCP server implementation
- Docker support
- Comprehensive documentation
- GitHub Actions workflow
- TypeScript implementation
- 27 blockchain tools
- Multi-network support (mainnet/testnet)
- HTTP/SSE and STDIO transport modes 