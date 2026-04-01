# X402PaymentVerifier -- DoS & Griefing Audit Findings

**Contract**: `X402PaymentVerifier.sol`
**Checklist**: DoS & Griefing Security Checklist
**Date**: 2026-04-02
**Auditor**: Claude Opus 4.6

---

## [DOS-1] Returndata bombing via `receiveWithAuthorization` call to token contract
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `settle()` (line 297-305)
**Description**: The `settle()` function calls `IERC3009(token).receiveWithAuthorization(...)` on a token address that was added by the contract owner via `setSupportedToken()`. While the token is owner-gated and not directly user-controlled, the EVM will copy all return data into memory. If a previously-legitimate token contract is upgraded (behind a proxy) or if the owner mistakenly registers a malicious token, the callee could return a massive payload, consuming the caller's gas via memory expansion costs. The same applies to the two `IERC20(token).balanceOf(address(this))` calls at lines 296 and 306, though `balanceOf` typically returns a fixed 32-byte word.

Because the token whitelist is owner-controlled, exploitation requires either a compromised/upgraded token or a social-engineering attack on the owner. This limits severity.

**Proof of Concept**:
1. Owner adds a proxy-based token to `supportedTokens`.
2. Token proxy is upgraded to a malicious implementation that returns megabytes of data from `receiveWithAuthorization`.
3. Any `settle()` call for that token consumes excessive gas due to memory expansion from return data copy.

**Recommendation**: Use `SafeERC20` wrappers for calls where possible, and consider using low-level assembly with `returndatasize()` checks for the `receiveWithAuthorization` call to cap return data. At minimum, document that only non-upgradeable tokens (or tokens behind timelocked proxies) should be registered.

---

## [DOS-2] Unbounded `sellerList` array is iterable via `getActiveSellers` and fillable on Conflux eSpace (L2)
**Severity**: Medium
**Category**: evm-audit-dos
**Location**: `sellerList` (line 96), `getActiveSellers()` (line 449), `registerSeller()` (line 154)
**Description**: The `sellerList` array grows without bound as new sellers register. While `getActiveSellers()` uses pagination (offset/limit), the array itself has no cap. On Conflux eSpace, where gas costs are extremely low, an attacker can register thousands of seller addresses at negligible cost. This creates two problems:

1. **Off-chain indexing burden**: Any service that calls `getActiveSellers()` must paginate through a potentially enormous list, which degrades backend/frontend performance.
2. **Storage bloat**: Each registration permanently consumes storage slots (the `Seller` struct is never deleted, only deactivated). The `sellerList` array only shrinks on deactivation, but the `sellers` mapping entry persists forever with `registeredAt > 0`, preventing re-registration at the same address -- though the attacker simply uses new addresses.

The `registerSeller()` function has no access control, rate limiting, or registration fee, making spam trivial on a low-gas chain.

**Proof of Concept**:
1. Attacker deploys a contract that calls `registerSeller()` in a loop from different `CREATE2`-deployed minimal proxies (each with a unique address).
2. On Conflux eSpace with sub-cent gas, filling `sellerList` with 100,000 entries is economically feasible.
3. Any off-chain service iterating over sellers is degraded.

**Recommendation**: Add a registration fee (even a small one) to make spam uneconomical, or restrict registration to owner-approved addresses. Example:
```solidity
uint256 public registrationFee = 1e18; // 1 CFX

function registerSeller(...) external payable {
    require(msg.value >= registrationFee, "X402: insufficient fee");
    // ... existing logic
}
```

---

## [DOS-3] Token transfer to blocklisted address blocks `release()` permanently
**Severity**: Medium
**Category**: evm-audit-dos
**Location**: `release()` (line 348)
**Description**: The `release()` function transfers escrowed funds to `p.recipient` using `IERC20(token).safeTransfer(recipient, amount)`. If the recipient address has been blocklisted by the token (e.g., USDC/USDT blocklists), the transfer reverts and funds are permanently locked in the contract. Once `block.timestamp >= p.releaseAt`, the escrow period has ended, so `refund()` also cannot be called (line 399: `require(block.timestamp < p.releaseAt)`). The payment is stuck: it cannot be released (blocklisted) and cannot be refunded (escrow ended).

**Proof of Concept**:
1. Seller registers and settles a payment for 1000 USDC.
2. During the escrow period, the seller's address gets blocklisted by USDC (Circle).
3. Escrow period passes. Anyone calls `release(invoiceId)`.
4. `safeTransfer` to the blocklisted seller reverts.
5. `refund()` also reverts because `block.timestamp >= p.releaseAt`.
6. Funds are permanently locked in the contract.

**Recommendation**: Add an emergency refund mechanism that the owner (or payer) can trigger when `release()` has been attempted but failed after the escrow period. Alternatively, allow the seller to update their wallet address, or add a try/catch around the release transfer with a fallback to refund:
```solidity
function emergencyRefund(bytes32 invoiceId) external onlyOwner {
    Payment storage p = payments[invoiceId];
    require(p.paidAt > 0 && !p.released && !p.refunded, "X402: invalid state");
    require(block.timestamp >= p.releaseAt, "X402: escrow still active");
    p.refunded = true;
    IERC20(p.token).safeTransfer(p.payer, p.amount);
}
```

---

## [DOS-4] Refund to blocklisted payer address reverts, no fallback
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `refund()` (line 381), `_refundTo()` (line 394)
**Description**: The `refund(invoiceId)` function sends tokens back to `p.payer`. If the original payer has been blocklisted by the token contract (e.g., USDC), this call reverts. The contract does provide `refundTo()` as a mitigation (allowing refund to an alternative address), so the seller can work around this. However, this requires the seller to know an alternative address for the payer, which may not always be available.

This is rated Low because the `refundTo()` escape hatch exists, but it depends on the seller's cooperation and knowledge of a valid alternative address.

**Proof of Concept**:
1. Payer pays via `settle()`.
2. Payer's address gets blocklisted by USDC.
3. Seller calls `refund(invoiceId)` -- reverts because `safeTransfer` to blocklisted payer fails.
4. Seller must use `refundTo()` with an alternative address, but may not know one.

**Recommendation**: Document clearly that sellers should use `refundTo()` when `refund()` fails. Consider allowing the payer to nominate a fallback refund address at settlement time.

---

## [DOS-5] `balanceOf()` revert on paused token causes `settle()` DoS
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `settle()` (lines 296, 306)
**Description**: The `settle()` function calls `IERC20(token).balanceOf(address(this))` before and after the `receiveWithAuthorization` call to verify the actual amount received. If the token contract is paused (some ERC-20 tokens like USDT have a pause mechanism that blocks all calls including `balanceOf()`), the `settle()` function reverts. This blocks all new settlements for that token until it is unpaused.

While this is a transient condition (it resolves when the token unpauses), it could delay time-sensitive payments.

**Proof of Concept**:
1. Token (e.g., USDT) is paused by its admin.
2. `settle()` calls `IERC20(token).balanceOf(address(this))` which reverts.
3. All settlements for this token are blocked until the token is unpaused.

**Recommendation**: Wrap `balanceOf` calls in try/catch, or accept this as an inherent risk of interacting with pausable tokens and document it. In practice, major stablecoins rarely pause, so this is an edge case.

---

## [DOS-6] Block stuffing viable on Conflux eSpace to prevent time-sensitive escrow releases
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `release()` (line 339), `_refundTo()` (line 399)
**Description**: The escrow mechanism has a time-sensitive boundary: sellers must call `refund()` before `releaseAt`, and `release()` becomes available after `releaseAt`. On Conflux eSpace (a low-gas-cost chain), block stuffing is economically more feasible than on Ethereum mainnet. An attacker could fill blocks with spam transactions near the `releaseAt` boundary to either:
- Prevent the seller from calling `refund()` before the deadline (griefing the refund window).
- Prevent `release()` from being called at a specific time (less impactful since release has no deadline).

The practical impact is limited because the escrow periods are measured in hours/days, making sustained block stuffing extremely expensive even on L2. However, the refund deadline creates a hard cutoff that could be targeted.

**Proof of Concept**:
1. Seller wants to refund a payment. `releaseAt` is approaching.
2. Attacker stuffs blocks near `releaseAt` to prevent the seller's `refund()` transaction from being included.
3. `block.timestamp` passes `releaseAt`. Seller can no longer refund.

**Recommendation**: Consider adding a small grace period after `releaseAt` during which the seller can still refund (but release is also available), creating a brief overlap window. This reduces the incentive for block stuffing at the boundary.
