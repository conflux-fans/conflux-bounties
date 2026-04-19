# Signature Security Audit -- X402PaymentVerifier

**Contract**: `X402PaymentVerifier.sol`
**Auditor**: Claude Opus 4.6
**Date**: 2026-04-02
**Scope**: Signature security checklist (ERC-3009 authorization handling, replay protection, parameter binding)

---

## [SIG-1] Endpoint not bound in buyer's signed authorization -- seller can misattribute payments
**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `settle()` (line 285-352)
**Description**: The `endpoint` parameter in `settle()` is stored in the `Payment` record and later checked by `verifyPayment()`, but it is **not part of the ERC-3009 signed data**. The buyer signs `(from, to, value, validAfter, validBefore, nonce)` via `receiveWithAuthorization` -- there is no commitment to any specific endpoint. The seller (who calls `settle()` as `msg.sender == recipient`) can record any arbitrary `endpoint` string.

This means a buyer who intends to pay for access to `/api/v1/basic` could have their payment recorded as covering `/api/v1/premium` or vice versa. Since `verifyPayment()` uses the endpoint for validation, this creates a mismatch between buyer intent and on-chain record.

If a third-party system relies on `verifyPayment()` to determine which resource was paid for, the seller can manipulate the attribution of payments.

**Proof of Concept**:
1. Buyer signs an ERC-3009 authorization for 10 USDC to Seller's contract address, intending to pay for `/api/basic`.
2. Seller calls `settle(token, buyer, seller, 10e6, validAfter, validBefore, nonce, "/api/premium", v, r, s)`.
3. The payment is recorded with `endpoint = "/api/premium"`.
4. Any system calling `verifyPayment(invoiceId, 10e6, "/api/basic")` returns `false` even though the buyer intended that endpoint.
5. Conversely, the seller can claim the buyer paid for the premium tier.

**Recommendation**: Include the endpoint in a secondary application-level signature from the buyer, or document clearly that the endpoint is seller-asserted metadata and should not be treated as buyer-committed. A minimal fix:

```solidity
// Option A: Add endpoint to invoiceId so it becomes deterministic and visible to the buyer before signing
bytes32 invoiceId = keccak256(abi.encode(from, recipient, token, nonce, keccak256(bytes(endpoint))));
```

This does not bind the endpoint cryptographically to the buyer's signature, but it makes the invoiceId depend on the endpoint, so the buyer can pre-compute and verify the expected invoiceId before signing the ERC-3009 authorization.

For full cryptographic binding, a separate EIP-712 signature from the buyer covering the endpoint (and the ERC-3009 nonce) would be needed.

---

## [SIG-2] Registration fee overpayment is silently absorbed -- no refund of excess
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `registerSeller()` (line 173), `reactivateSeller()` (line 199)
**Description**: Both `registerSeller()` and `reactivateSeller()` use `>=` comparison for the registration fee (`require(msg.value >= registrationFee, ...)`), meaning any excess native CFX sent beyond the required fee is permanently trapped in the contract. The `withdrawFees()` function sends the entire native balance to the owner, so overpayments become owner revenue rather than being returned to the seller.

**Proof of Concept**:
1. `registrationFee` is set to 1 CFX.
2. A seller calls `registerSeller{value: 10 CFX}(...)` (e.g., due to a frontend bug or manual transaction).
3. The 9 CFX overpayment is absorbed by the contract.
4. Owner calls `withdrawFees()` and receives all 10 CFX.

**Recommendation**: Either enforce exact payment or refund the excess:

```solidity
require(msg.value == registrationFee, "X402: incorrect registration fee");
```

Or refund:

```solidity
require(msg.value >= registrationFee, "X402: insufficient registration fee");
if (msg.value > registrationFee) {
    (bool refunded, ) = msg.sender.call{value: msg.value - registrationFee}("");
    require(refunded, "X402: refund failed");
}
```

---

## [SIG-3] Zero escrow duration eliminates buyer refund protection with no on-chain notice
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `settle()` (line 346), `_refundTo()` (line 452), `_validateEscrowDuration()` (line 562)
**Description**: A seller can register with `escrowDuration = 0`, which is validated as acceptable by `_validateEscrowDuration()`. When a payment is settled, `releaseAt = block.timestamp + 0`, meaning:

1. The `release()` function can be called in the same transaction (or same block) since `block.timestamp >= p.releaseAt` is immediately true.
2. The `_refundTo()` function requires `block.timestamp < p.releaseAt`, which is `block.timestamp < block.timestamp` -- always false. This means **refunds are impossible** for zero-escrow sellers.

While the code comments state "0 = immediate release, no escrow" (indicating this is intended), the buyer has no on-chain mechanism to verify the escrow duration before signing the ERC-3009 authorization. The buyer signs a payment to the contract address but cannot enforce a minimum escrow period.

A seller could register with a 24-hour escrow, attract buyers who verify this on-chain, then call `updateSeller()` to set `escrowDuration = 0` just before settling. The new duration applies to all future settlements immediately.

**Proof of Concept**:
1. Seller registers with `escrowDuration = 24 hours`.
2. Buyer checks on-chain that seller has a 24-hour escrow, signs ERC-3009 authorization.
3. Seller calls `updateSeller(url, desc, 0)` in transaction N.
4. Seller calls `settle(...)` in transaction N+1 (or same block).
5. `releaseAt = block.timestamp + 0`.
6. Seller calls `release(invoiceId)` immediately -- buyer cannot be refunded.

**Recommendation**: Consider adding a timelock to escrow duration reductions, or emit an event that off-chain systems can monitor for escrow changes:

```solidity
function updateSeller(string calldata apiBaseUrl, string calldata description, uint256 escrowDuration) external {
    require(sellers[msg.sender].active, "X402: not registered");
    require(bytes(apiBaseUrl).length > 0, "X402: empty API URL");

    sellers[msg.sender].apiBaseUrl = apiBaseUrl;
    sellers[msg.sender].description = description;
    if (escrowDuration > 0) {
        // Only allow increasing escrow immediately; decreases take effect after current duration
        if (escrowDuration < sellers[msg.sender].escrowDuration) {
            sellers[msg.sender].pendingEscrowDuration = escrowDuration;
            sellers[msg.sender].escrowChangeAt = block.timestamp + sellers[msg.sender].escrowDuration;
        } else {
            sellers[msg.sender].escrowDuration = _validateEscrowDuration(escrowDuration);
        }
    }
    emit SellerUpdated(msg.sender, apiBaseUrl, sellers[msg.sender].escrowDuration);
}
```

---

## [SIG-4] Seller can atomically settle and release in one block, bypassing escrow intent
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `settle()` (line 346), `release()` (line 366)
**Description**: Even with a non-zero escrow duration, `releaseAt` uses `block.timestamp + escrowDuration`. If a seller front-runs or simply calls `settle()` and `release()` in the same block, there is protection because `release()` checks `block.timestamp >= p.releaseAt`, and `releaseAt = block.timestamp + escrowDuration` would require `escrowDuration == 0` for same-block release.

However, this is noted for completeness: any seller with `escrowDuration = 0` can batch `settle()` + `release()` in a single multicall or sequential transactions within the same block. The `nonReentrant` guard prevents doing it in one call, but not across two calls in the same block via a router contract or bundler.

This is a design consideration rather than a vulnerability, since zero escrow is documented as intentional. No separate recommendation beyond SIG-3.

**Proof of Concept**: See SIG-3. With `escrowDuration = 0`, a seller (or a contract acting on the seller's behalf) can call `settle()` then `release()` in the same block.

**Recommendation**: See SIG-3 recommendation.

---

## Summary

| ID | Title | Severity |
|----|-------|----------|
| SIG-1 | Endpoint not bound in buyer's signed authorization | Medium |
| SIG-2 | Registration fee overpayment silently absorbed | Low |
| SIG-3 | Zero escrow duration eliminates refund protection | Low |
| SIG-4 | Same-block settle and release with zero escrow | Low |

### Checklist items reviewed and found NOT to be issues:

- **Missing chain ID in signature**: Chain ID is validated at line 298 via `DEPLOYMENT_CHAIN_ID`. ERC-3009 tokens include chain ID in their EIP-712 domain separator.
- **Missing address(this) in signature**: `address(this)` is passed as the `to` parameter to `receiveWithAuthorization` (line 327), binding the signed authorization to this contract.
- **Missing msg.sender binding**: Enforced at line 309 (`msg.sender == recipient`).
- **Nonce-less signatures / replay**: Application-level nonce tracking at lines 308, 319-320, plus ERC-3009 token-level nonce enforcement.
- **ecrecover returns address(0)**: Not applicable -- signature verification is delegated to the ERC-3009 token contract.
- **Signature malleability**: Not applicable -- handled by the ERC-3009 token's signature verification.
- **abi.encodePacked collision**: The contract uses `abi.encode` (not `encodePacked`) for all hash computations. No dynamic-type collisions.
- **DOMAIN_SEPARATOR cached at deployment**: The contract caches `DEPLOYMENT_CHAIN_ID` and validates it at runtime. If chain ID changes (fork), `settle()` reverts. The ERC-3009 token's DOMAIN_SEPARATOR is the token's responsibility.
- **Struct hash / EIP-712 compliance**: The contract does not construct its own EIP-712 signatures; it delegates to ERC-3009.
- **Permit front-running**: Not applicable -- `receiveWithAuthorization` requires `to == msg.sender` (the contract) or `to == caller`, preventing front-running by design.
- **No signature expiration**: `validBefore` is enforced at line 316 and capped by `MAX_AUTH_DURATION` at lines 312-315.
- **isValidSignature concerns**: Not applicable -- no ERC-1271 usage.
- **Cross-chain replay**: Mitigated by `DEPLOYMENT_CHAIN_ID` check and ERC-3009 domain separator.
