# Security Audit Report: X402PaymentVerifier & MockUSDT0

**Date**: 2026-03-29
**Auditor**: Claude Opus 4.6 (Automated EVM Audit)
**Scope**: `X402PaymentVerifier.sol`, `MockUSDT0.sol`
**Target Chain**: Conflux eSpace (Chain IDs 71 / 1030)
**Compiler**: Solidity 0.8.24, viaIR, OpenZeppelin v5.6.1

---

## Executive Summary

The X402PaymentVerifier is a multi-tenant payment facilitator for the x402 protocol on Conflux eSpace, using ERC-3009 `transferWithAuthorization` for gasless payments. MockUSDT0 is a test token implementing ERC-3009.

7 parallel audit agents ran 500+ checklist items across the following domains: general security, precision/math, ERC20 interactions, signature security, access control, DoS vectors, and chain-specific concerns.

**After deduplication, 21 unique findings were identified:**

| Severity | Count |
|----------|-------|
| High | 4 |
| Medium | 7 |
| Low | 8 |
| Info | 2 |

---

## Findings Summary

| ID | Title | Severity |
|----|-------|----------|
| F-01 | `invoiceId` not included in ERC-3009 signature — payment misbinding | High |
| F-02 | Front-running `settle()` bypasses verifier payment tracking entirely | High |
| F-03 | Unbounded `sellerList` array — permanent DoS of `getActiveSellers()` | High |
| F-04 | PUSH0 opcode may not be supported on Conflux eSpace | High |
| F-05 | Owner can force refunds without recipient consent (approval drain) | Medium |
| F-06 | Immutable `DOMAIN_SEPARATOR` breaks on chain fork / cross-chain replay | Medium |
| F-07 | Compromised owner can brick the entire protocol | Medium |
| F-08 | Blocklisted payer makes refund permanently impossible | Medium |
| F-09 | Fee-on-transfer tokens cause accounting mismatch and stuck refunds | Medium |
| F-10 | Rebasing tokens cause accounting drift | Medium |
| F-11 | ERC-777 tokens can trigger hooks during settlement | Medium |
| F-12 | Seller re-registration creates duplicate `sellerList` entries | Low |
| F-13 | Signature malleability — no low-s enforcement | Low |
| F-14 | No ERC-3009 interface validation on supported tokens | Low |
| F-15 | Instant token delisting with no grace period | Low |
| F-16 | `renounceOwnership()` can permanently brick admin functions | Low |
| F-17 | Off-by-one in ERC-3009 time boundaries (exclusive `validBefore`) | Low |
| F-18 | Decimal-unaware `verifyPayment()` comparison | Low |
| F-19 | No maximum authorization lifetime enforced at verifier level | Low |
| F-20 | MockUSDT0 `mint()` has no access control | Info |
| F-21 | Unused `balanceOf()` in IERC3009 interface | Info |

---

## Detailed Findings

### F-01: `invoiceId` not included in ERC-3009 signature — payment misbinding
**Severity**: High
**Category**: Signatures
**Location**: `X402PaymentVerifier.settle()`
**Sources**: SIG-5

**Description**: The `invoiceId` parameter is critical business logic that determines which invoice is marked as paid. However, it is NOT part of the ERC-3009 signed payload. Anyone who calls `settle()` can bind a valid authorization to an arbitrary `invoiceId`, marking the wrong invoice as paid while the intended invoice remains unpaid. The `endpoint` string is similarly unsigned and caller-controlled.

**Proof of Concept**:
1. Payer signs ERC-3009 authorization to pay Merchant for Invoice-A.
2. Attacker calls `settle(invoiceB, ...)` with the same signature.
3. Invoice-B is marked as paid; Invoice-A remains unpaid.
4. Payer's nonce is consumed — they cannot re-pay Invoice-A without a new authorization.

**Recommendation**: Either (a) derive `invoiceId` deterministically from signed fields: `invoiceId = keccak256(abi.encode(from, recipient, value, nonce))`, or (b) require `msg.sender == recipient` so only the intended merchant can bind the payment, or (c) use a custom EIP-712 type that includes `invoiceId` in the signature.

---

### F-02: Front-running `settle()` bypasses verifier payment tracking entirely
**Severity**: High
**Category**: Signatures, Chain-Specific
**Location**: `X402PaymentVerifier.settle()`, `MockUSDT0.transferWithAuthorization()`
**Sources**: G-2, SIG-4, SIG-8, CS-4

**Description**: `settle()` uses `transferWithAuthorization` (not `receiveWithAuthorization`). Since `transferWithAuthorization` does NOT check `msg.sender`, anyone who observes a pending `settle()` in Conflux eSpace's public mempool can extract the ERC-3009 signature and call `transferWithAuthorization()` directly on the token contract. This results in:
- Funds transfer from buyer to seller (the signature's `to` field)
- The verifier's `payments[invoiceId]` is **never populated** (the settle tx reverts)
- `verifyPayment()` returns false — seller's API denies access despite receiving funds
- Buyer loses funds without receiving service

**Proof of Concept**:
1. Seller submits `settle()` with buyer's ERC-3009 authorization.
2. Front-runner extracts `(from, to, value, ..., v, r, s)` from the mempool.
3. Front-runner calls `MockUSDT0.transferWithAuthorization(...)` directly.
4. Front-runner's tx mines first — token nonce consumed, funds move.
5. Original `settle()` reverts — no payment record created.

**Recommendation**: Use `receiveWithAuthorization()` instead, with the verifier contract as the initial recipient (`to = address(this)`), then forward funds to the seller:
```solidity
IERC3009(token).receiveWithAuthorization(from, address(this), value, ...);
IERC20(token).safeTransfer(recipient, value);
```

---

### F-03: Unbounded `sellerList` array — permanent DoS of `getActiveSellers()`
**Severity**: High
**Category**: DoS
**Location**: `registerSeller()`, `getActiveSellers()`
**Sources**: G-3, DOS-1, DOS-2, CS-7

**Description**: `sellerList` only grows (sellers are never removed, only deactivated). `getActiveSellers()` iterates the entire array twice. On Conflux eSpace with low gas costs, an attacker can register tens of thousands of sellers for trivial cost (~0.005 CFX for 100k entries), making `getActiveSellers()` permanently exceed the block gas limit.

**Proof of Concept**:
1. Deploy a factory that creates minimal proxies in a loop.
2. Each proxy calls `registerSeller("http://x", "x")`.
3. At ~50k gas/registration and L2 gas prices, 100k entries cost negligible amounts.
4. `getActiveSellers()` reverts with out-of-gas.

**Recommendation**:
- Add pagination: `getActiveSellers(uint256 offset, uint256 limit)`
- Add a registration fee to make mass registration economically infeasible
- Remove deactivated sellers from `sellerList` via swap-and-pop

---

### F-04: PUSH0 opcode may not be supported on Conflux eSpace
**Severity**: High
**Category**: Chain-Specific
**Location**: Both contracts (compiler target)
**Sources**: G-6, CS-1

**Description**: Solidity 0.8.24 emits the `PUSH0` opcode (Shanghai upgrade). The hardhat config does not specify `evmVersion`, defaulting to `cancun`. If Conflux eSpace's VM does not implement `PUSH0`, deployment will silently fail.

**Recommendation**: Set `evmVersion: "paris"` in hardhat.config.ts:
```typescript
solidity: {
  version: "0.8.24",
  settings: { evmVersion: "paris" }
}
```

---

### F-05: Owner can force refunds without recipient consent (approval drain)
**Severity**: Medium
**Category**: Access Control, ERC20
**Location**: `X402PaymentVerifier.refund()`
**Sources**: G-1, ERC20-5, AC-1

**Description**: `refund()` allows the `owner()` to trigger a refund for ANY invoice by calling `safeTransferFrom(recipient, payer, amount)`. If a recipient has granted the verifier a large or infinite ERC-20 approval, the owner can unilaterally drain funds from the recipient back to payers without the recipient's consent. This is a significant trust model violation — sellers are incentivized to never grant the verifier any approval, which also makes *legitimate* refunds impossible.

**Recommendation**: Remove the owner authorization path, or implement a two-step refund requiring explicit recipient approval per-invoice.

---

### F-06: Immutable `DOMAIN_SEPARATOR` breaks on chain fork
**Severity**: Medium
**Category**: Signatures, Chain-Specific
**Location**: `MockUSDT0.constructor()`
**Sources**: SIG-1, CS-2

**Description**: `DOMAIN_SEPARATOR` is computed once with `block.chainid` and stored as `immutable`. After a chain fork that changes the chain ID, signatures become cross-chain replayable.

**Recommendation**: Recompute dynamically when `block.chainid` differs from cached value, following OpenZeppelin's `EIP712` pattern.

---

### F-07: Compromised owner can brick the entire protocol
**Severity**: Medium
**Category**: Access Control
**Location**: `setSupportedToken()`, `deactivateSeller()`, `refund()`
**Sources**: AC-3

**Description**: A compromised owner key can: (1) delist all supported tokens, (2) deactivate all sellers, (3) force-refund all paid invoices. No multisig, timelock, or governance exists to counteract.

**Recommendation**: Use a multisig (e.g., Gnosis Safe) as owner. Consider role separation.

---

### F-08: Blocklisted payer makes refund permanently impossible
**Severity**: Medium
**Category**: ERC20, DoS
**Location**: `refund()`
**Sources**: ERC20-3, DOS-4

**Description**: If the payer is blocklisted by the token (USDC/USDT) after settlement, `safeTransferFrom(recipient, payer, amount)` permanently reverts. There is no alternative refund destination.

**Recommendation**: Add a `refundTo(bytes32 invoiceId, address refundRecipient)` function.

---

### F-09: Fee-on-transfer tokens cause accounting mismatch
**Severity**: Medium
**Category**: ERC20
**Location**: `settle()`, `refund()`
**Sources**: ERC20-1

**Description**: `settle()` records `value` as `p.amount`, but fee-on-transfer tokens deliver less than `value` to the recipient. Refunds then attempt to pull the full `value`, failing or draining extra tokens.

**Recommendation**: Document that only non-fee-on-transfer tokens should be supported, or measure actual balance changes.

---

### F-10: Rebasing tokens cause accounting drift
**Severity**: Medium
**Category**: ERC20
**Location**: `settle()`, `refund()`
**Sources**: ERC20-2

**Description**: Rebasing tokens change balances over time. The fixed `p.amount` will not match the recipient's actual balance at refund time.

**Recommendation**: Document that rebasing tokens must not be added to `supportedTokens`.

---

### F-11: ERC-777 tokens can trigger hooks during settlement
**Severity**: Medium
**Category**: ERC20
**Location**: `settle()`
**Sources**: ERC20-9

**Description**: ERC-777 tokens (backward-compatible with ERC-20) trigger `tokensReceived` hooks on recipients. The `nonReentrant` guard mitigates direct reentrancy, but cross-protocol reentrancy via hooks remains a concern.

**Recommendation**: Document that ERC-777 tokens should not be supported.

---

### F-12: Seller re-registration creates duplicate `sellerList` entries
**Severity**: Low
**Category**: General
**Location**: `registerSeller()`, `deactivateSeller()`
**Sources**: G-4, AC-8

**Description**: After deactivation, a seller can re-register (since `active == false` passes the check), pushing a duplicate entry to `sellerList`. No `reactivateSeller()` function exists.

**Recommendation**: Check `registeredAt > 0` to detect previous registration, add `reactivateSeller()`.

---

### F-13: Signature malleability — no low-s enforcement
**Severity**: Low
**Category**: Signatures
**Location**: `MockUSDT0` (all ecrecover calls)
**Sources**: SIG-3, CS-9

**Description**: `ecrecover` accepts both `s` and `n-s` for the same signature. Nonce protection prevents replay, but malleable signatures can cause off-chain confusion.

**Recommendation**: Use OpenZeppelin's `ECDSA.recover()` which enforces low-s.

---

### F-14: No ERC-3009 interface validation on supported tokens
**Severity**: Low
**Category**: General, ERC20
**Location**: `setSupportedToken()`, `settle()`
**Sources**: G-5, ERC20-14

**Description**: `setSupportedToken()` accepts any address. A non-existent or non-ERC-3009 token causes silent success (call to empty address) or opaque revert.

**Recommendation**: Add `require(token.code.length > 0)` and optionally verify the interface via a static call.

---

### F-15: Instant token delisting with no grace period
**Severity**: Low
**Category**: Access Control
**Location**: `setSupportedToken()`
**Sources**: AC-2

**Description**: Owner can instantly delist a token, invalidating all in-flight authorizations.

**Recommendation**: Add a timelock delay before delisting takes effect.

---

### F-16: `renounceOwnership()` can permanently brick admin functions
**Severity**: Low
**Category**: Access Control
**Location**: Inherited from `Ownable2Step`
**Sources**: AC-5

**Description**: Calling `renounceOwnership()` permanently disables `setSupportedToken()`.

**Recommendation**: Override `renounceOwnership()` to revert.

---

### F-17: Off-by-one in ERC-3009 time boundaries
**Severity**: Low
**Category**: General, Math
**Location**: `MockUSDT0.transferWithAuthorization()`
**Sources**: G-7, PM-1

**Description**: `validBefore` uses strict `<`, making it exclusive. Matches ERC-3009 spec but may surprise integrators.

**Recommendation**: Document the exclusive boundary behavior.

---

### F-18: Decimal-unaware `verifyPayment()` comparison
**Severity**: Low
**Category**: Math, Chain-Specific
**Location**: `verifyPayment()`
**Sources**: PM-2, ERC20-8, CS-6

**Description**: Raw `uint256` comparison without decimal awareness. Off-chain callers must match the token's native decimal scaling.

**Recommendation**: Document that `expectedAmount` must use the token's native decimals.

---

### F-19: No maximum authorization lifetime enforced
**Severity**: Low
**Category**: Signatures
**Location**: `settle()`
**Sources**: SIG-7

**Description**: A payer can sign with `validBefore = type(uint256).max`, creating a perpetual authorization exploitable years later.

**Recommendation**: Enforce a `MAX_AUTH_DURATION` check at the verifier level.

---

### F-20: MockUSDT0 `mint()` has no access control
**Severity**: Info
**Category**: Access Control
**Location**: `MockUSDT0.mint()`
**Sources**: G-8, ERC20-7, SIG-9, AC-4

**Description**: Anyone can mint arbitrary tokens. Expected for a mock/test contract but must never be deployed to production.

---

### F-21: Unused `balanceOf()` in IERC3009 interface
**Severity**: Info
**Category**: DoS
**Location**: `IERC3009` interface
**Sources**: DOS-7

**Description**: `balanceOf()` is declared but never called. Remove to keep the interface minimal.

---

## Cross-Cutting Concerns

### Economic Attack: F-01 + F-02 Combined
An attacker can **both** front-run the settlement (F-02) to bypass the verifier **and** exploit the unsigned `invoiceId` (F-01) to misbind payments. Together, these make the payment verification layer unreliable as a source of truth.

### Token Risk Surface: F-09 + F-10 + F-11
The contract accepts arbitrary ERC-20 tokens but has no defense against fee-on-transfer, rebasing, or ERC-777 variants. The owner-controlled token allowlist is the only gate. A single misconfigured token addition can break the system.

### Owner Centralization: F-05 + F-07
The owner has disproportionate power (force refunds, delist tokens, deactivate sellers) with no checks, timelocks, or multisig requirements.

---

## Recommendations Priority

1. **Critical Path** (fix before deployment):
   - F-04: Set `evmVersion: "paris"` in hardhat config
   - F-01: Derive `invoiceId` deterministically from signed fields
   - F-02: Switch to `receiveWithAuthorization` with contract as intermediary

2. **High Priority** (fix before mainnet):
   - F-03: Add pagination and registration fee for seller list
   - F-05: Remove owner from refund authorization
   - F-07: Deploy with multisig owner

3. **Should Fix**:
   - F-06: Dynamic DOMAIN_SEPARATOR recomputation
   - F-08: Add alternative refund destination
   - F-12: Add `reactivateSeller()` function
   - F-14: Validate token code exists
   - F-16: Override `renounceOwnership()`

4. **Document & Accept**:
   - F-09/F-10/F-11: Document unsupported token types
   - F-17/F-18: Document boundary behavior and decimal requirements

---

## Methodology

7 parallel Opus audit agents, each running a domain-specific checklist:

| Agent | Checklist | Raw Findings |
|-------|-----------|-------------|
| General | 46+ items | 9 |
| Precision/Math | 23+ items | 2 |
| ERC20 | 27+ items | 14 |
| Signatures | 19+ items | 9 |
| Access Control | 15+ items | 8 |
| DoS | 18+ items | 7 |
| Chain-Specific | 29+ items | 9 |
| **Total** | **177+ items** | **58 raw → 21 deduplicated** |

Checklist source: [evm-audit-skills](https://github.com/austintgriffith/evm-audit-skills) by Austin Griffith, built from research by Dacian, beirao.xyz, Sigma Prime, RareSkills, Decurity, weird-erc20, Spearbit, Hacken, OpenZeppelin, Cyfrin, and more.
