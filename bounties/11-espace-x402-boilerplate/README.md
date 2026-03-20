# x402 Payment Boilerplate - Conflux eSpace

End-to-end reference for the x402 (Payment Required) standard on Conflux.

## Components
- **api/**: Hono server with 402 paywall middleware, payment watcher
- **web/**: React payment UI with wagmi wallet integration
- **agent/**: Example AI agent that auto-handles 402 payments

## Quick Start
```bash
docker compose up -d
# Web UI: http://localhost:5173
# API: http://localhost:3001
```

## x402 Flow
1. Client requests paid resource → API returns 402 + payment headers
2. Client pays on-chain to specified address
3. Watcher detects payment, marks order confirmed
4. Client retries → API returns 200 with content

## Conflux eSpace
- Mainnet: Chain ID 1030, RPC: https://evm.confluxrpc.com
- Testnet: Chain ID 71, RPC: https://evm-testnet.confluxrpc.com

Closes #17
