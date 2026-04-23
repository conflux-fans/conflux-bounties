# Agent Sample Conversation

Below is a concrete sample session showing the AI agent discovering endpoints, paying for premium data, and retrieving the result. This is the output of `npm run dev:agent` (demo mode).

## Discovery → Payment → Premium Data Retrieval

```
Agent: Checking API health...
  → GET /health → 200 OK
  {"status":"ok","uptime":12345,"version":"0.1.0"}

Agent: Fetching free data (no payment needed)...
  → GET /data/free → 200 OK
  {
    "data": {
      "message": "This is free data available to everyone",
      "blockHeight": 847231,
      "timestamp": 1714012800000,
      "metrics": { "tps": "42.17", "activeAccounts": 31204 }
    }
  }

Agent: Requesting premium analytics data...
  → GET /data/premium → 402 Payment Required
  Received x402 challenge:
    Invoice ID : a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d
    Amount     : 0.10 USDT0
    Token      : 0x1234...MockUSDT0
    Endpoint   : /data/premium
    Expiry     : 1714013100 (5 minutes)
    Recipient  : 0xE90f...facilitator
    Verifier   : 0x5678...X402PaymentVerifier

  Checking agent pause status...
    → GET /agent/0xAgentAddress/status → 200 OK { paused: false }

  Budget check: 0.10 USDT0 fits within daily budget (5.00 remaining / 5.00 limit)

  Signing ERC-3009 ReceiveWithAuthorization (off-chain, no gas cost)...
    from  : 0xAgentAddress
    to    : 0x5678...X402PaymentVerifier
    value : 100000 (0.10 USDT0)
    nonce : 0x<sha256(invoiceId)>

  Submitting signed authorization to /invoices/a1b2c3d4-.../settle
    → POST /invoices/a1b2c3d4-.../settle → 200 OK
    { "verified": true, "txHash": "0xabc123...def456" }

  Retrying original request with payment proof...
    → GET /data/premium
      Headers: x-payment-invoice-id: a1b2c3d4-...
               x-payment-payer: 0xAgentAddress
    → 200 OK
  {
    "data": {
      "message": "Premium analytics data — thank you for your payment",
      "detailedMetrics": {
        "blockHeight": 847232,
        "tps": "58.91",
        "activeAccounts": 34102,
        "gasUsed": "891234567890",
        "topContracts": [
          { "address": "0xabc...123", "calls": 4521 },
          { "address": "0xdef...456", "calls": 3210 },
          { "address": "0x789...abc", "calls": 2101 }
        ],
        "historicalTrend": [ { "hour": 0, "txCount": 4821 }, "...(24 entries)" ]
      },
      "timestamp": 1714012812345
    }
  }

Agent: Session summary
  Total spent    : 0.10 USDT0
  Daily spent    : 0.10 USDT0
  Remaining cap  : 9.90 USDT0
  Transactions   : 1
```

## Key Observations

1. **Discovery**: The agent calls `/data/free` without payment — it's a free endpoint.
2. **402 Detection**: When calling `/data/premium`, the agent receives a 402 with full x402 challenge headers.
3. **Budget Check**: Before signing, the agent verifies the amount fits within its spend cap and daily budget.
4. **Gasless Signing**: The agent signs an EIP-712 `ReceiveWithAuthorization` message off-chain. The agent never pays gas.
5. **Settlement**: The signed authorization is submitted to the facilitator, who settles on-chain and pays gas.
6. **Retry with Proof**: The agent retries the original request with `x-payment-invoice-id` and `x-payment-payer` headers.
7. **Total Time**: The entire 402 → sign → settle → retry cycle completes in under 30 seconds (typically 5-15s on testnet).

## Running the Demo

```bash
# Start the API (in-memory dev mode)
npm run dev:api:local

# In another terminal, run the agent demo
npm run dev:agent
```

The demo mode runs a scripted flow: health check → free data → premium data (with payment) → compute simulation (with payment). See `apps/agent/src/index.ts` for the full demo script.
