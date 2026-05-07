# X402PaymentVerifier Security Audit Report

**Contract**: `packages/contracts/contracts/X402PaymentVerifier.sol` (552 lines)
**Chain**: Conflux eSpace (Chain ID 1030 mainnet / 71 testnet)
**Date**: 2026-04-02
**Auditor**: Claude Opus 4.6 (7 parallel domain agents)
**Methodology**: evm-audit-master v1 — 7 checklists, 350+ items checked

## Executive Summary

The X402PaymentVerifier is a multi-tenant escrow-based payment facilitator for the x402 HTTP payment protocol on Conflux eSpace. It uses ERC-3009 `receiveWithAuthorization` to pull tokens from buyers into escrow, with configurable per-seller escrow durations.

The contract demonstrates solid fundamentals: ReentrancyGuard + CEI pattern, Ownable2Step, SafeERC20, balance-before/after accounting, and timelocked token additions. However, the audit identified **significant issues in the trust model, cross-chain safety, and escrow boundary conditions** that could lead to fund loss or permanent lock.

## Findings Summary

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 1 | Cross-chain authorization replay |
| High | 4 | Buyer has no refund rights, blocklist permanent lock, invoiceId manipulation, seller refund redirect |
| Medium | 8 | Zero escrow bypass, fee-on-transfer gap, token pause window loss, seller reactivation bypass, owner instant token removal, 30-day fund trapping, PUSH0 compatibility, seller spam |
| Low | 10 | Various best-practice violations |
| Info | 6 | Gas optimizations, documentation gaps |

---

## Critical Findings

### [C-1] Cross-Chain ERC-3009 Authorization Replay
**Severity**: Critical
**Category**: evm-audit-signatures, evm-audit-chain-specific
**Location**: `settle()`
**Sources**: SIG-1, SIG-3, CHAIN-1, CHAIN-8, GEN-22

**Description**: The contract has zero chain-specific replay protection. If deployed at the same address on multiple EVM chains, a buyer's ERC-3009 authorization can be settled on each chain independently. The `usedNonces` mapping is per-deployment (separate storage on each chain). Cross-chain safety relies entirely on the token's EIP-712 `DOMAIN_SEPARATOR` including `block.chainid` — an external trust assumption that is neither validated nor documented.

Tokens that cache an immutable `DOMAIN_SEPARATOR` at deployment (common in older implementations) will not include the current `chainid` after a chain fork, making replay trivially exploitable.

**Proof of Concept**:
1. X402PaymentVerifier deployed at the same address on Conflux eSpace and another chain.
2. Buyer signs one `receiveWithAuthorization`.
3. Seller settles on chain A, then replays the same authorization on chain B with a different `invoiceId`.
4. Buyer is double-charged.

**Recommendation**: Store `block.chainid` as an immutable and validate at runtime:
```solidity
uint256 public immutable DEPLOYMENT_CHAIN_ID;

constructor(address[] memory _tokens) Ownable(msg.sender) {
    DEPLOYMENT_CHAIN_ID = block.chainid;
    // ...
}

function settle(...) external nonReentrant {
    require(block.chainid == DEPLOYMENT_CHAIN_ID, "X402: wrong chain");
    // ...
}
```

---

## High Findings

### [H-1] Buyer Has No On-Chain Refund Capability — Seller-Only Refund Model
**Severity**: High
**Category**: evm-audit-access-control
**Location**: `_refundTo()`, `refund()`, `refundTo()`
**Sources**: AC-01, AC-07

**Description**: All refund paths require `msg.sender == p.recipient` (the seller). The buyer has zero on-chain ability to dispute or request a refund. If a seller accepts payment but never delivers the service, the buyer must wait for the escrow period to end — at which point `release()` sends funds to the seller. Combined with a maximum escrow of 30 days (AC-07), a malicious seller can hold buyer funds hostage for a month with no buyer recourse.

**Recommendation**: Introduce a buyer-initiated dispute mechanism. For example: allow the buyer to flag a dispute during escrow, which pauses release and requires owner/arbiter resolution.

---

### [H-2] Blocklisted Recipient/Payer Causes Permanent Fund Lock — No Recovery Path
**Severity**: High
**Category**: evm-audit-erc20, evm-audit-dos
**Location**: `release()`, `releaseTo()`, `_refundTo()`
**Sources**: ERC20-3, ERC20-4, DOS-3, GEN-7

**Description**: USDC and USDT (the primary ERC-3009 tokens) implement address blocklists. If a recipient is blocklisted after settlement but before release:
- `release()` reverts (blocklisted transfer)
- `_refundTo()` reverts after escrow ends (`block.timestamp >= releaseAt`)
- `releaseTo()` requires `msg.sender == p.recipient` — if the recipient is a bricked contract, no one can call it

Similarly, if the payer is blocklisted, `refund()` reverts. While `refundTo()` provides a workaround, it requires the seller's cooperation.

There is **no emergency recovery function** — funds are permanently locked.

**Recommendation**: Add an owner-gated emergency function callable after a grace period:
```solidity
function emergencyRecovery(bytes32 invoiceId) external onlyOwner {
    Payment storage p = payments[invoiceId];
    require(p.paidAt > 0 && !p.released && !p.refunded);
    require(block.timestamp > p.releaseAt + 90 days, "X402: grace period");
    p.refunded = true;
    IERC20(p.token).safeTransfer(p.payer, p.amount);
}
```

---

### [H-3] Seller Controls Invoice Attribution — invoiceId Not Bound to Buyer's Signature
**Severity**: High
**Category**: evm-audit-signatures, evm-audit-general
**Location**: `settle()`
**Sources**: GEN-1, SIG-2

**Description**: The `invoiceId` is caller-supplied and not part of the ERC-3009 signed payload. Since `msg.sender == recipient` is enforced, the seller chooses which invoice to bind to the buyer's authorization. A malicious seller can misattribute payments (recording payment against a wrong invoice), or a competing seller/MEV bot can front-run with the same `invoiceId` to block a legitimate settlement.

**Recommendation**: Derive `invoiceId` deterministically: `bytes32 invoiceId = keccak256(abi.encode(from, recipient, token, nonce))`, or require a buyer-signed EIP-712 message that commits to `(invoiceId, recipient, amount, token, endpoint)`.

---

### [H-4] Seller Can Redirect "Refund" to Arbitrary Address — Effectively Stealing Buyer Funds
**Severity**: High
**Category**: evm-audit-access-control, evm-audit-general
**Location**: `refundTo()`
**Sources**: GEN-2, AC-03

**Description**: The `refundTo()` function allows the seller to send escrowed funds to any address except `address(0)` and `p.recipient`. The seller can "refund" to their own alternate wallet, marking the payment as `refunded = true` — effectively stealing buyer funds under the guise of a refund.

**Recommendation**: Restrict refunds to the original payer:
```solidity
function refundTo(bytes32 invoiceId, address refundRecipient) external nonReentrant {
    require(refundRecipient == payments[invoiceId].payer, "X402: can only refund to payer");
    // OR require payer's signature for alternative addresses
    _refundTo(invoiceId, refundRecipient);
}
```

---

## Medium Findings

### [M-1] Zero Escrow Duration Bypasses Escrow Protection Entirely
**Severity**: Medium
**Category**: evm-audit-general, evm-audit-precision-math, evm-audit-chain-specific
**Location**: `_validateEscrowDuration()`, `settle()`, `release()`
**Sources**: GEN-3, MATH-2, AC-06, DOS-9, CHAIN-3

**Description**: `MIN_ESCROW_DURATION = 0` allows sellers to register with zero escrow. With `escrowDuration = 0`, `releaseAt = block.timestamp`, making `release()` callable in the same block while `refund()` is permanently impossible (`block.timestamp < block.timestamp` is always false). On Conflux eSpace with ~0.5s blocks, even 1-second escrows provide no practical protection.

**Recommendation**:
```solidity
uint256 public constant MIN_ESCROW_DURATION = 1 hours;

function _validateEscrowDuration(uint256 duration) internal pure returns (uint256) {
    require(duration >= MIN_ESCROW_DURATION, "X402: escrow too short");
    require(duration <= MAX_ESCROW_DURATION, "X402: escrow too long");
    return duration;
}
```

---

### [M-2] Fee-on-Transfer/Rebasing Token Restrictions Are Documentation-Only
**Severity**: Medium
**Category**: evm-audit-erc20, evm-audit-precision-math
**Location**: `settle()`, `proposeToken()`
**Sources**: ERC20-1, ERC20-2, MATH-1, GEN-24

**Description**: The NatSpec warns against fee-on-transfer and rebasing tokens, but no on-chain guard prevents the owner from adding one. The balance-before/after pattern correctly captures actual received amounts, but downstream verification fails: `verifyPayment()` comparing `p.amount` (received) against `expectedAmount` (nominal value) returns false.

**Recommendation**: Add `require(received == value, "X402: non-standard transfer")` in `settle()` to enforce the documented restriction on-chain.

---

### [M-3] Token Pause Eliminates Refund Window Permanently
**Severity**: Medium
**Category**: evm-audit-erc20, evm-audit-dos
**Location**: `release()`, `_refundTo()`
**Sources**: ERC20-5, DOS-10

**Description**: If a token is paused during the escrow window, `_refundTo()` reverts. Escrow timers continue advancing. When the token unpauses, the refund window may have closed (`block.timestamp >= releaseAt`), permanently eliminating the refund option even though the seller wanted to refund.

**Recommendation**: Allow the recipient to mark a payment as "refund-pending" during escrow (preserving the right even if transfer fails), or allow the owner to extend escrow deadlines during token pauses.

---

### [M-4] Deactivated Seller Can Immediately Reactivate — Owner Deactivation Is Ineffective
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `deactivateSeller()`, `reactivateSeller()`
**Sources**: GEN-5

**Description**: The owner can deactivate a malicious seller via `deactivateSeller()`, but that seller can immediately call `reactivateSeller()` to become active again. There is no blocklist mechanism.

**Recommendation**: Add a blocklist that prevents reactivation:
```solidity
mapping(address => bool) public blockedSellers;
function blockSeller(address wallet) external onlyOwner { ... }
// In reactivateSeller: require(!blockedSellers[msg.sender]);
```

---

### [M-5] Owner Can Remove Token Support Instantly — Asymmetric With 48-Hour Addition Timelock
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `removeToken()`
**Sources**: AC-04

**Description**: `removeToken()` takes effect instantly while `proposeToken()`/`activateToken()` enforce a 48-hour delay. A compromised owner can instantly disrupt all new settlements for a token. Existing escrows remain unaffected (release/refund don't check `supportedTokens`), but the asymmetry is a governance gap.

**Recommendation**: Apply the same timelock pattern to token removal, or require a governance vote.

---

### [M-6] PUSH0 Opcode Risk — pragma ^0.8.24 on Conflux eSpace
**Severity**: Medium
**Category**: evm-audit-chain-specific, evm-audit-general
**Location**: `pragma solidity ^0.8.24`
**Sources**: GEN-12, CHAIN-2

**Description**: Solidity 0.8.24 defaults to Shanghai EVM which emits `PUSH0`. The project's Hardhat config correctly sets `evmVersion: "paris"`, but the pragma allows compilation with any tool without this safeguard.

**Recommendation**: Add an in-source comment: `/// @dev MUST compile with evmVersion "paris" for Conflux eSpace compatibility.`

---

### [M-7] Seller Spam via Unbounded sellerList on Low-Gas Conflux eSpace
**Severity**: Medium
**Category**: evm-audit-dos, evm-audit-chain-specific
**Location**: `registerSeller()`, `sellerList`
**Sources**: DOS-2, CHAIN-5

**Description**: With `registrationFee` defaulting to 0 and Conflux's sub-cent gas costs, an attacker can register thousands of sellers at negligible cost, bloating `sellerList`.

**Recommendation**: Set a meaningful default registration fee in the constructor and/or add a cap on `sellerList.length`.

---

### [M-8] Tree-Graph Consensus Reorg Risk at Escrow Boundaries
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `settle()`, `release()`, `_refundTo()`
**Sources**: CHAIN-4

**Description**: Conflux's tree-graph consensus can cause reorgs that shift `block.timestamp`, altering `releaseAt`. A refund valid pre-reorg could become invalid post-reorg at the escrow boundary.

**Recommendation**: Add a grace period (e.g., 5 minutes) to refund eligibility past the escrow boundary.

---

## Low Findings

| ID | Title | Sources |
|----|-------|---------|
| L-1 | `release()` is permissionless — third parties can front-run seller's intended refund | GEN-6, ERC20-6, AC-10 |
| L-2 | Registration fee overpayment silently absorbed | GEN-9, AC-09 |
| L-3 | `updateSeller`/`reactivateSeller` cannot set escrow to zero (0 = "no change") | GEN-10 |
| L-4 | `verifyPayment()` does not report `released` status | GEN-13 |
| L-5 | No `from` address validation — `address(0)` and `address(this)` not excluded | GEN-14 |
| L-6 | `setRegistrationFee()` has no upper bound or timelock | GEN-17, AC-05 |
| L-7 | No token rescue function for accidentally sent ERC-20 tokens | GEN-19, ERC20-9 |
| L-8 | `withdrawFees()` could brick if owner is an ETH-rejecting contract | GEN-21, DOS-7, CHAIN-9 |
| L-9 | Redundant `usedNonces` tracking duplicates token's nonce enforcement (~20k gas overhead) | SIG-4 |
| L-10 | Escrow boundary at exact `releaseAt` allows release but not refund (undocumented) | GEN-15, MATH-3 |

---

## Informational Findings

| ID | Title | Sources |
|----|-------|---------|
| I-1 | Double computation of nonce key hash in `settle()` — ~100 gas waste | GEN-11 |
| I-2 | `reactivateSeller()` emits `SellerRegistered` instead of distinct event | GEN-18 |
| I-3 | `Payment.endpoint` stored as full string on-chain — hash would save gas | GEN-20 |
| I-4 | Duplicate token addresses in constructor silently accepted | GEN-16, ERC20-14 |
| I-5 | ERC-3009 limits settlement to EOA wallets only (no smart contract wallet support) | ERC20-12 |
| I-6 | No hardcoded addresses — correct multi-chain portability (positive finding) | CHAIN-11 |

---

## Cross-Cutting Concerns

### Trust Model Imbalance
The most pervasive issue across multiple skill domains is the **extreme asymmetry in the buyer-seller trust model**. The buyer signs an off-chain authorization and has zero on-chain recourse: cannot initiate refunds (H-1), cannot control invoice attribution (H-3), cannot prevent refund redirection (H-4), and is subject to seller-chosen escrow durations from 0 to 30 days (M-1). This is a design-level concern that compounds with token-specific risks (blocklists, pauses) to create scenarios where buyer funds are permanently lost.

### Blocklist + Escrow Timer = Permanent Lock
Token blocklists (H-2) interact with escrow timers (M-1, M-3) to create permanent fund locks. If a transfer fails during the escrow window, the timer continues. Once escrow expires, refunds are permanently blocked. There is no emergency recovery path, no owner intervention mechanism, and no way to extend deadlines.

### Cross-Chain Risk Surface
The contract has no chain-binding (C-1, M-6). Combined with unbound `invoiceId` (H-3) and per-deployment nonce tracking, multi-chain deployments create an expanded attack surface where the same authorization can be replayed across chains.

---

## Positive Design Patterns

- **ReentrancyGuard + CEI**: All state-modifying external functions use `nonReentrant`, and state updates precede external calls.
- **Ownable2Step**: Two-step ownership with `renounceOwnership()` disabled.
- **SafeERC20**: All outgoing token transfers use `safeTransfer`.
- **Balance-before/after**: `settle()` correctly measures actual received tokens rather than trusting the `value` parameter.
- **Timelocked token addition**: 48-hour delay on new token activation.
- **Paginated view functions**: `getActiveSellers()` uses offset/limit pagination.
- **No hardcoded addresses**: Fully configurable token support.
- **`receiveWithAuthorization`**: Correct use of the receive variant (vs transfer) prevents third-party front-running at the token level.

---

## Methodology

Seven parallel audit agents each walked a specialized checklist:

| Agent | Checklist Items | Raw Findings |
|-------|----------------|--------------|
| evm-audit-general | 46+ | 24 |
| evm-audit-precision-math | 23+ | 7 |
| evm-audit-erc20 | 27+ | 18 |
| evm-audit-signatures | 19+ | 8 |
| evm-audit-access-control | 15+ | 17 |
| evm-audit-dos | 18+ | 10 |
| evm-audit-chain-specific | 29+ | 11 |

**Total raw findings**: 95 across all agents
**After deduplication and synthesis**: 1 Critical, 4 High, 8 Medium, 10 Low, 6 Info = **29 unique findings**

---

*Generated by Claude Opus 4.6 EVM Audit System*
*Checklists: [evm-audit-skills](https://github.com/austintgriffith/evm-audit-skills)*
