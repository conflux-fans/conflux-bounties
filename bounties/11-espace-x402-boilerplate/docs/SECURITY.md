# Security Considerations

Threat model and hardening guidance for the Conflux eSpace x402 payment boilerplate.

## 1. Facilitator Gas Griefing

The seller's facilitator wallet pays gas for all settlement transactions on eSpace. An attacker can submit crafted requests with invalid EIP-712 signatures, causing on-chain reverts that still consume gas.

**Current mitigations:**
- Off-chain EIP-712 signature pre-validation before broadcasting any transaction
- Rate limiting on `/settle` (5 requests/min/IP)

**Production recommendations:**
- IP reputation scoring (flag IPs with high revert ratios)
- Require a refundable deposit or proof-of-payment before settlement
- Monitor facilitator wallet balance with alerts

## 2. Invoice ID Replay Protection

Invoice IDs alone are not secrets. The system binds them to additional context to prevent unauthorized reuse.

**Current protections:**
- Invoice ID is bound to the payer address via the `x-payment-payer` header
- Invoices are scoped to specific API endpoints
- Nonces enforce uniqueness per invoice

**Without the `x-payment-payer` header**, any party holding a paid invoice ID could access premium data. Always enforce this header in middleware.

## 3. Private Key Management

`SERVICE_WALLET_KEY` (facilitator) and `AGENT_PRIVATE_KEY` are stored in `.env`.

**Rules:**
- Never commit keys to git (`.env` is in `.gitignore`)
- Rotate keys via the `/admin/keys` endpoint

**Production recommendations:**
- Use HSMs or cloud KMS (AWS KMS, GCP Cloud KMS)
- Hardware wallets for high-value facilitator accounts
- Separate key material from application servers
- Implement key rotation schedules with zero-downtime swaps

## 4. ERC-3009 Authorization Security

Buyers sign off-chain EIP-712 typed data messages authorizing token transfers (`transferWithAuthorization`).

**Validation layers:**
- **Off-chain**: Pre-validation recovers the signer and checks against the declared payer before submitting any transaction
- **On-chain**: The token contract verifies the signature and enforces nonce uniqueness (bytes32)
- **Database**: Invoice nonces (UUID) are tracked to prevent duplicate processing

**Replay protection is multi-layered:**
- Nonce uniqueness (contract-level bytes32 + database-level UUID)
- Expiry timestamps (`validBefore`) reject stale authorizations
- Endpoint scoping prevents cross-endpoint reuse of the same authorization

## 5. Admin API Security

Admin endpoints (`/admin/*`) are protected by an API key passed in the `Authorization` header.

**Current protections:**
- API key validation middleware
- Audit logging of admin actions (already implemented)

**Production recommendations:**
- Replace static API keys with JWT tokens supporting role-based access control
- IP allowlisting for admin endpoints
- Require MFA for key rotation and agent pause/unpause operations

## 6. CORS Configuration

CORS is currently configured with wildcard origin (`*`) via Hono `cors()`.

**Production requirement:** Restrict `origin` to specific allowed domains. Wildcard CORS combined with credentialed requests is a security risk.

```ts
cors({ origin: ['https://your-frontend.example.com'] })
```

## 7. Rate Limiting

Rate limiting is per-IP using in-memory storage.

**Known limitations:**
- State is lost on server restart
- Trivially bypassed with IP rotation or distributed attacks

**Production recommendations:**
- Use Redis-backed rate limiting for persistence and horizontal scaling
- Enforce per-API-key rate limits (not just per-IP)
- Apply stricter limits to unauthenticated endpoints
- Use sliding window counters instead of fixed windows

## 8. Agent Spending Safety

The `SpendTracker` enforces total spending caps and daily budgets per agent.

**Current protections:**
- Hard total cap and daily budget enforcement
- Admin can pause agents immediately via `POST /admin/agent/:address/pause`
- Webhook alerts when spend exceeds configured thresholds (via `ALERT_WEBHOOK_URL`)

**Production recommendations:**
- Set conservative initial caps; increase only with manual approval
- Alert at 80% threshold, hard-block at 100%
- Log all spending events to an append-only audit trail
- Implement cooldown periods after rapid spending bursts

## 9. Database Security

**Current protections:**
- All SQL queries use parameterized template literals (via the `postgres` package), preventing SQL injection
- CSV export includes formula injection protection (prefixing cells that start with `=`, `+`, `-`, `@`)

**Production recommendations:**
- Enable SSL/TLS on PostgreSQL connections (`ssl: { rejectUnauthorized: true }`)
- Use a dedicated database user with minimal privileges (no DDL)
- Enable query logging and slow query monitoring
- Encrypt sensitive columns (payment amounts, addresses) at rest

## 10. Testnet vs Production Differences

The following must change before mainnet deployment:

| Area | Testnet (current) | Production |
|---|---|---|
| **Network** | Conflux eSpace testnet (chain 71) | Conflux eSpace mainnet (chain 1030) |
| **Tokens** | Test USDC (freely mintable) | Real USDC (actual value at risk) |
| **Key management** | `.env` file | HSM / KMS |
| **Rate limiting** | In-memory | Redis-backed |
| **CORS** | Wildcard `*` | Explicit origin allowlist |
| **Database** | Local PostgreSQL, no SSL | Managed PostgreSQL with SSL, backups, PITR |
| **Monitoring** | Console logs | Structured logging, APM, on-chain event indexing |
| **Admin auth** | Static API key | JWT + RBAC + IP allowlist |
| **Facilitator funding** | Testnet faucet CFX | Real CFX (monitor balance, auto-top-up) |
| **Alerts** | Optional webhook | Required: PagerDuty/Opsgenie integration |
| **Audit** | Database logs | Append-only external audit log (S3, immutable storage) |
