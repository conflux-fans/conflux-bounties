# X402PaymentVerifier -- Security Audit Report

**Contract**: `packages/contracts/contracts/X402PaymentVerifier.sol`
**Compiler**: Solidity ^0.8.24 (compiled with evmVersion: "paris")
**Chain**: Conflux eSpace (testnet chain 71, mainnet chain 1030)
**Date**: 2026-04-02
**Methodology**: 7 parallel specialist agents, each walking a domain-specific checklist (500+ items total)
**Skills Used**: evm-audit-general, evm-audit-precision-math, evm-audit-erc20, evm-audit-signatures, evm-audit-access-control, evm-audit-dos, evm-audit-chain-specific

---

## Executive Summary

The X402PaymentVerifier is a well-structured payment facilitator with escrow-based refunds. It follows good patterns: CEI ordering, ReentrancyGuard, Ownable2Step, SafeERC20, balance-difference accounting, and `receiveWithAuthorization` for front-running prevention.

No **Critical** or **High** severity findings were identified. The contract's minimal arithmetic surface and delegation of signature verification to ERC-3009 tokens eliminate entire classes of vulnerabilities.

The primary concerns are around the **trust model** (seller controls refund routing, escrow duration, and invoiceId binding) and **edge-case fund locking** (token blocklists after settlement). These are design trade-offs, not bugs, and are appropriate for an experimental/non-production boilerplate.

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 6 |
| Low | 8 |
| Info | 7 |
| **Total** | **21** |

---

## Medium Findings

### [M-1] Seller can redirect refunds to arbitrary address via `refundTo()`

**Location**: `refundTo()` line 389
**Sources**: AC-03, G-6, ERC20-6

The `refundTo()` function lets the seller send escrowed funds to any address during the escrow period. While designed for blocklisted payers, a malicious seller could "refund" to their own address, keeping the funds while marking the payment as refunded. The buyer gets nothing.

**Impact**: Seller can steal payer's funds under the guise of a refund.

**Recommendation**: Block refund to the seller's own address:
```solidity
require(refundRecipient != p.recipient, "X402: cannot refund to seller");
```

---

### [M-2] Token blocklist permanently locks escrowed funds (no `releaseTo()`)

**Location**: `release()` line 348
**Sources**: DOS-3, ERC20-3

If a seller gets blocklisted by USDC/USDT after settlement but before release, `safeTransfer` in `release()` reverts permanently. After the escrow period, `refund()` also fails (escrow ended). Funds are permanently locked with no recovery path.

Unlike `refundTo()` which provides an alternative-address escape hatch, `release()` has no equivalent `releaseTo()`.

**Recommendation**: Add `releaseTo()` allowing the seller to specify an alternative release address:
```solidity
function releaseTo(bytes32 invoiceId, address to) external nonReentrant {
    Payment storage p = payments[invoiceId];
    require(p.paidAt > 0 && !p.released && !p.refunded);
    require(block.timestamp >= p.releaseAt);
    require(msg.sender == p.recipient);
    require(to != address(0));
    p.released = true;
    IERC20(p.token).safeTransfer(to, p.amount);
    emit PaymentReleased(invoiceId, to, p.token, p.amount);
}
```

---

### [M-3] No chain ID binding in the contract's invoiceId namespace

**Location**: `settle()` line 281, `Payment` struct
**Source**: SIG-3

The `invoiceId` is an opaque `bytes32` with no chain-scoping. If the contract is deployed at the same address on multiple chains (via CREATE2), the same `invoiceId` could be used on different chains. Off-chain systems querying `verifyPayment()` may not distinguish which chain the payment was made on.

**Recommendation**: Include `block.chainid` in event emissions, or document that `invoiceId` uniqueness is per-deployment only.

---

### [M-4] Seller controls invoiceId with no binding to payer's signed authorization

**Location**: `settle()` lines 263-325
**Source**: SIG-4

The `invoiceId` is chosen by the seller and is not part of the payer's ERC-3009 signature. A seller could associate any `invoiceId` with any valid authorization. Off-chain systems relying on `verifyPayment(invoiceId, ...)` trust the seller to correctly map invoices to authorizations.

**Recommendation**: Document that the seller is trusted for invoice binding. For higher assurance, include invoiceId in additional signed data.

---

### [M-5] Instant token whitelist changes without timelock

**Location**: `setSupportedToken()` line 420
**Sources**: AC-01, AC-02

The owner can instantly add malicious tokens or remove legitimate ones. Adding a token with unexpected behavior (re-entrancy hooks, fee-on-transfer) could affect sellers who auto-accept any supported token. Removing tokens blocks new settlements immediately.

**Recommendation**: Add a timelock for adding new tokens (48h). Token removal can be instant for safety.

---

### [M-6] Unbounded `sellerList` fillable cheaply on Conflux eSpace

**Location**: `sellerList` line 96, `registerSeller()` line 154
**Source**: DOS-2

No registration fee or access control means an attacker can spam thousands of seller registrations at negligible gas cost on Conflux eSpace. This bloats storage and degrades off-chain indexing.

**Recommendation**: Add a small registration fee (e.g., 1 CFX) or require owner approval.

---

## Low Findings

### [L-1] Off-by-one at escrow boundary: refund impossible at exact `releaseAt` timestamp
**Location**: `release()` line 339, `_refundTo()` line 399
**Sources**: G-5, PM-2

At `block.timestamp == releaseAt`, refund reverts but release succeeds. A seller's last-second refund could be front-run by `release()`. Document this boundary or use `<=` / `>` for inclusive refund window.

### [L-2] ERC-3009 signature is ECDSA-only, no smart contract wallet support
**Location**: `IERC3009` interface, `settle()`
**Source**: ERC20-11

Smart contract wallets (Gnosis Safe, ERC-4337) cannot sign ERC-3009 authorizations. This is an ERC-3009 limitation, not a contract bug. Document it.

### [L-3] No mechanism to recover accidentally sent tokens
**Location**: Contract-wide
**Sources**: G-7, ERC20-9

Tokens sent directly to the contract (not via `settle()`) are permanently locked. Consider an owner-only rescue function for unaccounted surplus.

### [L-4] Deactivated seller can self-reactivate, no blocklist mechanism
**Location**: `reactivateSeller()` line 178
**Source**: G-9

If the owner deactivates a compromised seller, that address can call `reactivateSeller()` to become active again. Add an owner-controlled blocklist.

### [L-5] Redundant nonce tracking duplicates ERC-3009's own replay protection
**Location**: `settle()` lines 282-293
**Source**: SIG-2

The contract's `usedNonces` mapping is redundant with the ERC-3009 token's native nonce enforcement. Belt-and-suspenders is fine, but document that primary replay protection comes from the token.

### [L-6] `verifyPayment` does not expose `released` status
**Location**: `verifyPayment()` lines 358-371
**Source**: G-11

Off-chain systems cannot distinguish "in escrow" from "released to seller" via `verifyPayment()`.

### [L-7] Owner can deactivate any seller instantly without notice
**Location**: `deactivateSeller()` line 216
**Source**: AC-04

Owner can instantly block sellers from new settlements. Consider a grace period for owner-initiated deactivations.

### [L-8] Escrow duration change takes effect immediately with no event field
**Location**: `updateSeller()` line 200
**Sources**: AC-05, AC-06

Sellers can reduce escrow duration to near-zero instantly. The `SellerUpdated` event doesn't include the new duration, making off-chain monitoring blind to this change.

---

## Informational Findings

### [I-1] `abi.encodePacked` safe for current types but `abi.encode` is more defensive
**Sources**: G-1, SIG-1

### [I-2] Duplicate tokens in constructor silently accepted
**Sources**: G-4, ERC20-8

### [I-3] Double keccak256 computation of nonce key wastes gas
**Source**: G-10

### [I-4] `reactivateSeller` emits `SellerRegistered` (indistinguishable from new registration)
**Source**: G-12

### [I-5] `endpoint` string stored on-chain is expensive; a hash would suffice
**Source**: G-14

### [I-6] Tautological `MIN_ESCROW_DURATION = 0` makes the require check dead code
**Source**: PM-1

### [I-7] PUSH0 correctly mitigated via `evmVersion: "paris"` in Hardhat config
**Source**: CS-4

---

## Positive Design Patterns

The contract gets several things right:

- **CEI pattern** consistently applied in `settle()`, `release()`, and `_refundTo()`
- **ReentrancyGuard** on all state-modifying external functions
- **Ownable2Step** prevents accidental ownership transfers
- **`renounceOwnership` disabled** prevents bricking admin functions
- **`receiveWithAuthorization`** (not `transferWithAuthorization`) prevents front-running
- **Balance-difference accounting** in `settle()` handles fee-on-transfer edge cases
- **SafeERC20** used for all outbound transfers
- **Paginated view functions** prevent gas limit issues on `getActiveSellers()`
- **Swap-and-pop** for O(1) seller removal from active list
- **No hardcoded addresses** makes the contract multi-chain portable
- **NatSpec documentation** clearly warns against rebasing/fee-on-transfer tokens

---

## Scope Exclusions

The following were reviewed and found not applicable:
- Proxy/upgradeability vulnerabilities (contract is not upgradeable)
- Oracle manipulation (no oracle dependencies)
- Flash loan attacks (no flash-loan-exploitable state)
- Governance attacks (no governance mechanism)
- AMM/vault/staking math (no DeFi primitives)
- Inline assembly (none used)

---

## Detailed Findings

Individual checklist findings are available in:
- `findings-general.md` (15 findings)
- `findings-precision-math.md` (3 findings)
- `findings-erc20.md` (11 findings)
- `findings-signatures.md` (7 findings)
- `findings-access-control.md` (6 findings)
- `findings-dos.md` (6 findings)
- `findings-chain-specific.md` (6 findings)

Raw total: 54 findings across 7 specialists, deduplicated to 21 unique findings in this report.
