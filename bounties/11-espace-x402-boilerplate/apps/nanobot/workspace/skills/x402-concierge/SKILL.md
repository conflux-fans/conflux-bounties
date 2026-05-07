---
name: x402-concierge
description: Deep knowledge of the x402 payment protocol on Conflux eSpace
metadata:
  nanobot:
    always: true
    emoji: "💸"
---

# x402 Protocol Knowledge Base

## What is x402?

x402 is a **machine-readable payment protocol** that uses HTTP status code **402 Payment Required** to gate API access behind micropayments. Unlike traditional API keys or subscriptions, x402 lets any HTTP client — human or AI agent — pay per request using on-chain tokens.

This implementation uses **ERC-3009 (transferWithAuthorization)** on **Conflux eSpace**, meaning buyers sign a payment authorization off-chain (no gas) and a facilitator submits it on-chain (paying gas on the buyer's behalf).

## HTTP 402 Response Format

When a client calls a premium endpoint without payment, the server responds:

```
HTTP/1.1 402 Payment Required

Headers:
  X-Payment-Amount: "100000"           (0.10 USDT0, 6 decimals)
  X-Payment-Token: "0x65B5Acf..."      (USDT0 contract address)
  X-Payment-Nonce: "uuid-v4"           (unique per invoice)
  X-Payment-Expiry: "1700000000"       (Unix timestamp, 5 min default)
  X-Payment-Endpoint: "/data/premium"  (which endpoint)
  X-Payment-Invoice-Id: "uuid-v4"      (ephemeral invoice ID)
  X-Payment-Recipient: "0xE90f..."     (seller's wallet)
```

## ERC-3009 Payment Flow

1. **Client calls premium endpoint** → gets 402 with payment headers
2. **Client signs EIP-712 `TransferWithAuthorization`** off-chain (free, no gas)
3. **Client POSTs signed auth** to `/invoices/:id/settle`
4. **Facilitator** (seller's service wallet) calls `X402PaymentVerifier.settle()` on-chain, paying gas
5. **Smart contract** verifies the buyer's signature and transfers USDT0 from buyer → seller
6. **Client retries** original request with `X-Payment-Invoice-Id` header → gets premium data

Key insight: **Buyers never pay gas.** The facilitator absorbs gas costs, which are trivial on Conflux eSpace (~0.001 CFX per settlement).

## Smart Contracts

### X402PaymentVerifier
- Multi-tenant: any seller can register and receive payments
- `settle()`: Executes ERC-3009 transfer from buyer → seller
- `verifyPayment()`: Check if an invoice is paid with correct amount and endpoint
- `refund()`: Seller or contract owner can refund a paid invoice
- Replay protection via nonce tracking + invoice deduplication
- Uses CEI (Checks-Effects-Interactions) pattern + ReentrancyGuard

### MockUSDT0
- ERC-20 token with full ERC-3009 support for testnet
- `transferWithAuthorization()`: Gasless transfers via EIP-712 signature
- Anyone can `mint()` on testnet for testing

## Supported Tokens

| Token | Mainnet Address | Decimals |
|-------|----------------|----------|
| USDT0 | `0xfe97E85d13ABD9c1c33384E796F10B73905637cE` | 6 |
| CNHT0 | `0xdEd1660192D4D82E7c0b628BA556861eDbb5caDa` | 6 |

Both support ERC-3009 `transferWithAuthorization` on Conflux eSpace (chain 1030 mainnet, chain 71 testnet).

## Architecture

```
Web Client / AI Agent
    │
    ▼ HTTP request
Seller API (Hono)
    │
    ├── x402 Middleware: checks pricing, issues 402 challenges, verifies paid invoices
    ├── Settlement: accepts signed ERC-3009 auth, submits on-chain via facilitator
    ├── Rate Limiter: per-IP limits on settlement (5/min)
    └── Admin: pricing management, analytics, API key rotation
    │
    ▼ RPC (viem)
Conflux eSpace
    ├── X402PaymentVerifier (settlement + verification)
    └── MockUSDT0 (ERC-3009 token)
```

## Agent Safety Controls

- **Spend cap**: Maximum total USDT0 the agent can spend (default: 10 USDT0)
- **Daily budget**: Maximum daily spend, resets at midnight (default: 5 USDT0)
- **Max retries**: 3 attempts per endpoint before giving up
- **Session persistence**: All transactions recorded to SQLite for audit trail

## Common Questions

**Q: Why use ERC-3009 instead of regular token transfers?**
A: ERC-3009 lets the buyer authorize a transfer off-chain (just a signature, no gas). The seller or a facilitator submits it on-chain. This means buyers never need gas tokens — critical for a smooth payment UX.

**Q: What prevents replay attacks?**
A: Three layers: (1) Each authorization has a unique nonce tracked on-chain, (2) Each invoice ID can only be paid once, (3) Authorizations have an expiry timestamp.

**Q: What happens if settlement fails?**
A: The agent retries up to 3 times. The seller API sends alerts on settlement failures. If the on-chain tx succeeds but the DB update fails, clients can use `/invoices/:id/verify` to recover.

**Q: How much does it cost to use?**
A: Free endpoints cost nothing. Premium data costs 0.10 USDT0 (~$0.10) per call. Compute simulation costs 0.50 USDT0 (~$0.50) per call. On testnet, tokens are free to mint.
