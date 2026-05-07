# Operational Runbooks

## Rotate Service Wallet Key

The service wallet (facilitator) pays gas for on-chain settlements. If the key is compromised:

1. **Generate a new wallet:**
   ```bash
   npx tsx -e "import {generatePrivateKey, privateKeyToAccount} from 'viem/accounts'; const k = generatePrivateKey(); console.log('Key:', k); console.log('Address:', privateKeyToAccount(k).address)"
   ```

2. **Fund the new wallet** with testnet CFX from https://efaucet.confluxnetwork.org/

3. **Update the on-chain verifier contract** (owner only):
   ```bash
   # Via Hardhat console or a script
   npx hardhat console --network confluxTestnet
   > const verifier = await ethers.getContractAt("X402PaymentVerifier", "0xYOUR_VERIFIER_ADDRESS")
   > await verifier.setServiceWallet("0xNEW_WALLET_ADDRESS")
   ```

4. **Update `.env`:**
   ```
   SERVICE_WALLET_KEY=0xnew_private_key
   SERVICE_WALLET_ADDRESS=0xnew_address
   ```

5. **Restart the seller API:**
   ```bash
   docker compose restart seller-api
   ```

6. **Verify** by calling a premium endpoint and settling — check that the facilitator tx comes from the new address.

---

## Rotate API Keys

1. **Disable the compromised key:**
   ```bash
   curl -X PATCH http://localhost:4000/admin/keys/<key-id> \
     -H "Content-Type: application/json" \
     -d '{"enabled": false}'
   ```

2. **Create a new key:**
   ```bash
   curl -X POST http://localhost:4000/admin/keys \
     -H "Content-Type: application/json" \
     -d '{"label": "replacement-key", "ownerId": "owner-id", "rateLimit": 120}'
   ```

3. Distribute the new key to the affected client. The old key is immediately rejected (returns 403).

---

## Refill Testnet Faucet

### CFX (for gas)
1. Go to https://efaucet.confluxnetwork.org/
2. Enter the service wallet address
3. Request testnet CFX

### MockUSDT0 (for payments)
Anyone can mint on testnet. From the web UI, connect a wallet and use the "Mint Test USDT0" section. Or via contract call:

```bash
# Via cast (foundry)
cast send $USDT0_ADDRESS "mint(address,uint256)" $WALLET_ADDRESS 1000000000 --rpc-url https://evmtestnet.confluxrpc.com --private-key $PRIVATE_KEY
# Mints 1000 USDT0 (6 decimals)
```

---

## Handle a Refund / Dispute

### Prerequisites
The service wallet must have approved the X402PaymentVerifier contract to spend tokens on its behalf:
```bash
cast send $USDT0_ADDRESS "approve(address,uint256)" $VERIFIER_ADDRESS 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff --rpc-url https://evmtestnet.confluxrpc.com --private-key $SERVICE_WALLET_KEY
```

### Issue a Refund

1. **Find the invoice ID** from the admin dashboard or API:
   ```bash
   curl http://localhost:4000/invoices?status=paid
   ```

2. **Submit the refund:**
   ```bash
   curl -X POST http://localhost:4000/invoices/<invoice-id>/refund
   ```
   This calls `X402PaymentVerifier.refund()` on-chain, transferring tokens from the service wallet back to the original payer.

3. **Verify** the invoice status is now `refunded`:
   ```bash
   curl http://localhost:4000/invoices/<invoice-id>
   ```

### Dispute Process
For disputes where the buyer claims they didn't receive data:

1. Check `usage_logs` for the request corresponding to the invoice
2. Verify the premium data response was actually returned (check API logs)
3. If the service failed to deliver, issue a refund (see above)
4. If delivery is confirmed, no refund — direct the buyer to the tx hash as proof of service

---

## Adjust Endpoint Pricing

```bash
# Update price for /data/premium to 0.20 USDT0 (200000 in 6 decimal units)
curl -X PUT http://localhost:4000/admin/pricing/data/premium \
  -H "Content-Type: application/json" \
  -d '{"price": "200000", "description": "Premium data feed (updated)", "tier": "premium"}'
```

Pricing changes take effect immediately for new invoices. Existing unpaid invoices keep their original price.

---

## Agent Spend Cap Exceeded

If the alert webhook fires a `settlement_failed` or the agent reports budget exhaustion:

1. **Check agent spend summary:**
   ```bash
   npm run dev:agent -- direct /health  # any call will print the spend summary
   ```

2. **Reset daily budget** by restarting the agent (daily counter resets on startup) or updating `AGENT_DAILY_BUDGET` in `.env`

3. **Increase cap** if needed:
   ```
   AGENT_SPEND_CAP=20000000   # 20 USDT0
   AGENT_DAILY_BUDGET=10000000 # 10 USDT0
   ```

4. Restart: `docker compose --profile agent restart agent`

---

## Export Billing Data

Download a CSV of all invoices for external billing/accounting:

```bash
curl -o usage-export.csv http://localhost:4000/admin/analytics/export
```

Or use the "Export CSV" button on the admin dashboard.
