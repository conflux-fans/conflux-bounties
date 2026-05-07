# Security Audit Report: X402PaymentVerifier

**Contract**: `X402PaymentVerifier.sol`
**Chain**: Conflux eSpace
**Solidity**: `^0.8.24`
**Date**: 2026-04-02
**Auditor**: Claude Opus 4.6
**Methodology**: 7 parallel specialist agents, 500+ checklist items across general, precision-math, ERC20, signatures, access-control, DoS, and chain-specific domains.

---

## Executive Summary

The X402PaymentVerifier is a well-architected escrow-based payment facilitator using ERC-3009 `receiveWithAuthorization` on Conflux eSpace. The contract demonstrates strong security fundamentals: `Ownable2Step`, disabled `renounceOwnership`, CEI pattern, `ReentrancyGuard`, `SafeERC20`, balance-before/after checks, paginated views, and timelocked token additions.

**No Critical or High severity findings were identified.**

The main risks are: (1) blocklisted addresses permanently locking escrowed funds, (2) zero-escrow sellers making refunds impossible, (3) the `endpoint` field not being cryptographically bound to the buyer's intent, and (4) no on-chain enforcement of ERC-3009 compliance for added tokens. Precision/math is clean -- the contract performs no arithmetic on payment amounts.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 5 |
| Low | 9 |
| Info | 3 |
| **Total** | **17** |

---

## Findings

### Medium Severity

## [M-1] Blocklisted addresses permanently lock escrowed funds
**Severity**: Medium
**Category**: evm-audit-erc20, evm-audit-dos
**Location**: `release()` :375, `releaseTo()` :384, `_refundTo()` :462
**Description**: USDC and USDT implement address blocklists. If a payer is blocklisted after settlement, `refund()` and `refundTo()` both revert -- `refundTo()` enforces `refundRecipient == payer`, so there is no alternative refund path. The seller's side is partially mitigated by `releaseTo()`, but if the seller is also blocklisted and loses key access, funds are permanently locked. There is no admin rescue mechanism.
**Proof of Concept**:
1. Buyer pays 1000 USDC via `settle()`. Escrow is 24 hours.
2. Buyer's address is added to USDC blocklist during escrow.
3. `refund(invoiceId)` reverts (safeTransfer to blocklisted address fails).
4. `refundTo(invoiceId, altAddr)` reverts (`altAddr != payer`).
5. After escrow, seller can `release()` but refund path is permanently broken.
**Recommendation**: Add an admin emergency rescue function gated by a long timeout (e.g., 90 days after `releaseAt`):
```solidity
function emergencyRescue(bytes32 invoiceId, address to) external onlyOwner {
    Payment storage p = payments[invoiceId];
    require(p.paidAt > 0 && !p.released && !p.refunded, "X402: invalid state");
    require(block.timestamp >= p.releaseAt + 90 days, "X402: rescue too early");
    require(to != address(0), "X402: zero address");
    p.released = true;
    IERC20(p.token).safeTransfer(to, p.amount);
}
```

---

## [M-2] Zero escrow duration makes refunds permanently impossible
**Severity**: Medium
**Category**: evm-audit-general, evm-audit-signatures
**Location**: `_refundTo()` :452, `_validateEscrowDuration()` :562
**Description**: Sellers can register with `escrowDuration = 0` (explicitly allowed). This sets `releaseAt = block.timestamp`, making the refund condition `block.timestamp < releaseAt` always false -- refunds are impossible even in the same block. Furthermore, a seller can use `updateSeller()` to reduce their escrow to 0 right before settling, eliminating buyer refund protection with no timelock or notice.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 24 hours` (buyer verifies on-chain).
2. Seller calls `updateSeller(url, desc, 0)` -- escrow drops to 0 instantly.
3. Seller calls `settle(...)` -- `releaseAt = block.timestamp`.
4. Seller calls `release(invoiceId)` -- succeeds immediately. Refund is impossible.
**Recommendation**: Either enforce a minimum non-zero escrow (`MIN_ESCROW_DURATION = 1 hours`), or add a timelock to escrow duration reductions so buyers have time to react:
```solidity
// Option A: Enforce minimum
uint256 public constant MIN_ESCROW_DURATION = 1 hours;

// Option B: Change refund boundary to allow same-block refunds
// In _refundTo: require(block.timestamp <= p.releaseAt, ...)
// In release:  require(block.timestamp > p.releaseAt, ...)
```

---

## [M-3] Endpoint not cryptographically bound to buyer's signed authorization
**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `settle()` :285-352
**Description**: The `endpoint` parameter is seller-supplied metadata not included in the ERC-3009 signed data. The seller controls which endpoint is recorded, enabling misattribution of payments. Since `verifyPayment()` checks the endpoint, a malicious seller can record a different endpoint than what the buyer intended.
**Proof of Concept**:
1. Buyer signs authorization intending to pay for `/api/basic`.
2. Seller calls `settle(... "/api/premium" ...)`.
3. `verifyPayment(invoiceId, amount, "/api/basic")` returns false.
4. Seller can claim buyer paid for premium tier.
**Recommendation**: Include the endpoint hash in the invoiceId derivation so it becomes deterministic:
```solidity
bytes32 invoiceId = keccak256(abi.encode(from, recipient, token, nonce, keccak256(bytes(endpoint))));
```

---

## [M-4] No on-chain enforcement that added tokens implement ERC-3009
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `proposeToken()` :473, `activateToken()` :484
**Description**: The `proposeToken`/`activateToken` flow only checks `code.length > 0` and `!supportedTokens[token]`. It does not verify the token implements ERC-3009. If an admin adds a standard ERC-20 without ERC-3009, it appears "supported" in mappings but `settle()` always reverts, confusing integrators. The "non-fee-on-transfer, non-rebasing" constraints are enforced only by NatSpec.
**Proof of Concept**:
1. Owner proposes DAI (no ERC-3009 support).
2. After 48 hours, activates it. `supportedTokens[DAI] = true`.
3. All settle attempts for DAI revert. Frontend shows DAI as supported.
**Recommendation**: Add a best-effort interface check:
```solidity
(bool success, ) = token.staticcall(
    abi.encodeWithSelector(IERC3009.authorizationState.selector, address(0), bytes32(0))
);
require(success, "X402: token lacks ERC-3009");
```

---

## [M-5] Unbounded seller registration spam on Conflux eSpace (cheap gas, zero default fee)
**Severity**: Medium
**Category**: evm-audit-dos
**Location**: `registerSeller()` :186, `registrationFee` default = 0
**Description**: The default `registrationFee` is 0, and Conflux eSpace has cheap gas. An attacker can deploy thousands of minimal proxy contracts, each calling `registerSeller()` for free, bloating `sellerList`. While `getActiveSellers()` is paginated, off-chain systems calling `getSellerCount()` and attempting full enumeration will degrade.
**Proof of Concept**:
1. `registrationFee` is 0 (default).
2. Attacker deploys factory creating 10,000 proxies, each calling `registerSeller()`.
3. `sellerList.length` = 10,000+. Off-chain indexers degrade.
**Recommendation**: Enforce a minimum non-zero registration fee:
```solidity
uint256 public constant MIN_REGISTRATION_FEE = 0.01 ether;
function setRegistrationFee(uint256 fee) external onlyOwner {
    require(fee >= MIN_REGISTRATION_FEE, "X402: fee below minimum");
    registrationFee = fee;
}
```

---

### Low Severity

## [L-1] Excess registration fee not refunded
**Severity**: Low
**Category**: evm-audit-general, evm-audit-access-control
**Location**: `registerSeller()` :173, `reactivateSeller()` :199
**Description**: Both functions use `msg.value >= registrationFee` but never refund the excess. Overpayment is permanently absorbed and swept by the owner via `withdrawFees()`.
**Recommendation**: Use exact match (`==`) or refund excess via `.call{value: excess}("")`.

---

## [L-2] PUSH0 opcode risk -- deployment depends on build config
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `pragma solidity ^0.8.24` :2
**Description**: Solidity >= 0.8.20 emits `PUSH0` by default. Conflux eSpace does not support it. The Hardhat config sets `evmVersion: "paris"` (correct), but any alternative build tool (Foundry, Remix, CI) without this setting will produce broken bytecode.
**Recommendation**: Pin pragma to `^0.8.19` or add prominent documentation/CI checks enforcing `evmVersion: "paris"`.

---

## [L-3] No token rescue for directly transferred or stranded tokens
**Severity**: Low
**Category**: evm-audit-general, evm-audit-erc20
**Location**: Contract-level (no rescue mechanism)
**Description**: Tokens sent directly to the contract (not via `settle()`) or stranded by ERC-3009 nonce front-running (`transferWithAuthorization` called directly on the token) are permanently locked. There is no admin rescue function.
**Recommendation**: Add an owner-only rescue function. A safe implementation requires tracking total escrowed balance per token to prevent touching active escrows.

---

## [L-4] Registration fee change takes effect instantly without timelock
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `setRegistrationFee()` :505
**Description**: Unlike token additions (48h timelock), the registration fee can be changed instantly. A compromised owner could front-run a seller's registration with a massive fee increase.
**Recommendation**: Add a timelock consistent with token activation, or at minimum refund excess payment.

---

## [L-5] Owner can remove all supported tokens instantly (asymmetric timelock)
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `removeToken()` :495
**Description**: Token addition has a 48h timelock, but removal is instant. A compromised owner can disable all new settlements immediately. Existing escrows are unaffected, but the protocol is frozen for new business. Re-adding tokens requires another 48h wait.
**Recommendation**: Consider adding a timelock to token removal, or document this as an accepted trust assumption.

---

## [L-6] Owner can deactivate any seller without notice
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `deactivateSeller()` :234
**Description**: The owner can instantly deactivate any seller, preventing new settlements. No timelock, reason field, or appeal mechanism exists. Existing escrows are unaffected.
**Recommendation**: Add an event field for deactivation reason and consider a grace period. Document trust assumption.

---

## [L-7] Seller can front-run deactivation to settle pending authorizations
**Severity**: Low
**Category**: evm-audit-general
**Location**: `deactivateSeller()` :234, `settle()` :309
**Description**: When the owner deactivates a malicious seller, the seller can observe the pending transaction and front-run with `settle()` on outstanding buyer authorizations. With zero escrow, they can also immediately `release()`.
**Recommendation**: Consider a two-step deactivation: freeze settlements first, then deactivate after a delay.

---

## [L-8] Hardcoded token addresses in deploy script bypass timelock
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `scripts/deploy.ts`
**Description**: The constructor accepts initial tokens without the 48h timelock that protects runtime additions. Stale or incorrect addresses at deployment are a one-shot risk.
**Recommendation**: Validate token addresses at deploy time by querying `name()`/`symbol()`/`decimals()` and logging for human verification.

---

## [L-9] `withdrawFees()` fails if owner is a reverting contract
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `withdrawFees()` :516
**Description**: Fee withdrawal sends CFX to `owner()` via `.call{value:}`. If the owner is a multisig whose fallback reverts, fees are permanently stuck.
**Recommendation**: Add `withdrawFeesTo(address payable to)` allowing the owner to specify a recipient.

---

### Informational

## [I-1] Documentation-code mismatch in `refundTo()` NatSpec
**Severity**: Info
**Category**: evm-audit-general
**Location**: `refundTo()` :436-445
**Description**: NatSpec says "or to a payer-specified alternative address" but code enforces `refundRecipient == payer`, making `refundTo()` identical to `refund()`.
**Recommendation**: Update NatSpec to match actual behavior.

---

## [I-2] Chain ID check absent in release/refund paths
**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: `release()` :361, `_refundTo()` :447
**Description**: `settle()` checks `block.chainid == DEPLOYMENT_CHAIN_ID` but release/refund functions do not. On a hypothetical chain fork, an already-settled payment could be released on both chains.
**Recommendation**: Add chain ID check to release/refund for defense-in-depth if desired.

---

## [I-3] Constructor role grants not documented in NatSpec
**Severity**: Info
**Category**: evm-audit-access-control
**Location**: `constructor()` :147
**Description**: The deployer becomes the owner with power to manage tokens, set fees, deactivate sellers, and withdraw fees. These privileges are not documented in the contract NatSpec.
**Recommendation**: Add explicit NatSpec listing owner privileges and noting that the owner cannot move escrowed ERC-20 tokens.

---

## Cross-Cutting Analysis

### Interaction: M-1 + M-2 (Blocklist + Zero Escrow)
A seller with `escrowDuration = 0` who gets blocklisted has no recovery path at all. `release()` reverts (blocklisted recipient), and `releaseTo()` requires `msg.sender == p.recipient` (the blocklisted seller can still call this if blocklisting only affects token transfers, not arbitrary calls). However, if the seller also loses key access, funds are permanently locked with no admin rescue.

### Interaction: M-2 + M-3 (Zero Escrow + Unbound Endpoint)
A seller with zero escrow can misattribute the endpoint and immediately release funds, leaving no window for dispute or correction.

### Economic Attack Vector
With zero registration fee (M-5) + zero escrow duration (M-2), an attacker can register as a seller, settle payments with arbitrary endpoints, and release immediately -- all at no cost. The registration fee and escrow duration are the two key economic deterrents that should both be non-zero.

---

## What the Contract Does Well

1. **Ownable2Step** with `renounceOwnership` disabled -- prevents accidental bricking
2. **CEI pattern** consistently applied in settle, release, and refund
3. **ReentrancyGuard** on all state-changing external functions
4. **Balance-before/after** pattern in `settle()` -- correctly handles non-standard tokens
5. **SafeERC20** for all outbound transfers
6. **receiveWithAuthorization** (not transferWithAuthorization) -- prevents front-running by design
7. **Deterministic invoiceId** from `(from, recipient, token, nonce)` -- prevents misattribution
8. **Paginated view functions** -- no unbounded loop DoS in reads
9. **48-hour timelock** on token additions -- users have time to react
10. **Immutable chain ID** check in `settle()` -- cross-chain replay protection
11. **No precision/math risk** -- amounts pass through unmodified (confirmed by precision-math audit: 0 findings)

---

## Appendix: Specialist Findings Files

| Agent | File | Findings |
|-------|------|----------|
| General | `findings-general.md` | 6 |
| Precision-Math | `findings-precision-math.md` | 0 |
| ERC20 | `findings-erc20.md` | 8 |
| Signatures | `findings-signatures.md` | 4 |
| Access Control | `findings-access-control.md` | 5 |
| DoS | `findings-dos.md` | 6 |
| Chain-Specific | `findings-chain-specific.md` | 5 |
| **Total (pre-dedup)** | | **34** |
| **Total (deduplicated)** | | **17** |
