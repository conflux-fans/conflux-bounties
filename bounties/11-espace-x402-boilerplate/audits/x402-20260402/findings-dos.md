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

---

## [DOS-7] `withdrawFees()` reverts if owner is a contract that rejects ETH
**Severity**: Medium
**Category**: evm-audit-dos
**Location**: `withdrawFees()`
**Description**: The `withdrawFees()` function sends the contract's ETH balance to `owner()` using a low-level `.call{value: balance}("")`. If the owner is a multisig or smart contract wallet that has a `receive()` function which reverts (or no `receive()`/`fallback()` function at all), the withdrawal permanently fails. Since `Ownable2Step` allows transferring ownership to any address including contracts, accumulated registration fees become permanently locked.

This is Medium because it affects protocol revenue (owner-only fund loss) and could be triggered by a legitimate ownership transfer to a contract wallet that inadvertently rejects plain ETH transfers.

**Proof of Concept**:
1. Owner transfers ownership to a multisig contract that does not implement `receive()` or `fallback()`.
2. Sellers register and pay registration fees, accumulating ETH in the contract.
3. New owner calls `withdrawFees()`.
4. `owner().call{value: balance}("")` reverts because the multisig rejects the ETH transfer.
5. Registration fees are permanently locked.

**Recommendation**: Add a `withdrawFeesTo(address payable to)` function that allows the owner to specify a withdrawal destination, or use a pull-based withdrawal pattern where the owner sets a recipient and the recipient claims:
```solidity
function withdrawFeesTo(address payable to) external onlyOwner {
    require(to != address(0), "X402: zero address");
    uint256 balance = address(this).balance;
    require(balance > 0, "X402: no fees");
    (bool sent, ) = to.call{value: balance}("");
    require(sent, "X402: withdrawal failed");
}
```

---

## [DOS-8] Seller can set `MAX_ESCROW_DURATION` (30 days) to trap buyer funds
**Severity**: Medium
**Category**: evm-audit-dos
**Location**: `registerSeller()`, `_validateEscrowDuration()`
**Description**: A seller can set their `escrowDuration` to `MAX_ESCROW_DURATION` (30 days). When a buyer's payment is settled, their funds are locked for the full 30-day escrow period before `release()` can be called. During this time, the buyer has no recourse -- the contract provides no mechanism for the buyer to withdraw or dispute. The buyer's funds are effectively trapped for a month.

While the seller's escrow duration is visible on-chain before the buyer signs the ERC-3009 authorization, the x402 protocol flow typically involves automated HTTP 402 responses where the buyer's wallet signs the authorization without the user inspecting escrow terms. A malicious seller could initially register with a short escrow, build trust, then `deactivateSeller` + `reactivateSeller` with a 30-day escrow to bait-and-switch.

**Proof of Concept**:
1. Malicious seller registers with `escrowDuration = 30 days`.
2. Buyer's wallet automatically authorizes a payment via x402 flow.
3. Seller calls `settle()`, locking buyer's funds for 30 days.
4. Seller never provides the paid-for service.
5. Buyer cannot retrieve funds for 30 days. Seller may never call `refund()`.

**Recommendation**: Either reduce `MAX_ESCROW_DURATION` to a more reasonable value (e.g., 3-7 days), or give the buyer a dispute/cancel mechanism that can be invoked during the escrow period. Alternatively, require the buyer to explicitly acknowledge the escrow duration in the signed authorization.

---

## [DOS-9] Zero escrow duration allows instant release with no refund window
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `_validateEscrowDuration()`, `release()`
**Description**: `MIN_ESCROW_DURATION` is 0, and `_validateEscrowDuration()` only checks `duration <= MAX_ESCROW_DURATION`. A seller can register with `escrowDuration = 0`, which means `releaseAt = block.timestamp + 0 = paidAt`. The moment `settle()` completes, `release()` can be called in the same block (or even the same transaction via a multicall pattern). This eliminates any refund window: the seller (or a bot) can atomically settle and release, making refunds impossible.

The `refund()` check `require(block.timestamp < p.releaseAt)` would fail immediately since `block.timestamp >= releaseAt` from the moment of settlement.

**Proof of Concept**:
1. Seller registers with `escrowDuration = 0`.
2. Buyer authorizes payment via ERC-3009.
3. Seller calls `settle()` then `release()` in the same transaction (via a wrapper contract).
4. Funds are immediately transferred to the seller.
5. If the service was not delivered, the buyer has no recourse -- `refund()` is already blocked.

**Recommendation**: Set a non-zero `MIN_ESCROW_DURATION` (e.g., 1 hour or 15 minutes) to ensure buyers always have a refund window:
```solidity
uint256 public constant MIN_ESCROW_DURATION = 1 hours;

function _validateEscrowDuration(uint256 duration) internal pure returns (uint256) {
    require(duration >= MIN_ESCROW_DURATION, "X402: escrow too short");
    require(duration <= MAX_ESCROW_DURATION, "X402: escrow too long");
    return duration;
}
```

---

## [DOS-10] Token pause blocks all `release()` and `refund()` operations permanently during pause
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `release()`, `_refundTo()`
**Description**: If a supported token (e.g., USDC, USDT) is paused by its admin, all `safeTransfer` calls in `release()`, `releaseTo()`, `refund()`, and `refundTo()` will revert. This creates a complete DoS on all escrowed payments for that token. Unlike `settle()` (covered in DOS-5), this affects funds already locked in the contract.

During a pause, escrow timers continue to advance. If the pause outlasts a payment's escrow period, the refund window closes while the token is paused, and the seller loses the ability to refund even after the token unpauses. This converts a transient DoS into a permanent loss of the refund option.

**Proof of Concept**:
1. Multiple payments are escrowed in USDC.
2. USDC is paused (e.g., regulatory action).
3. Seller wants to refund a payment but `_refundTo()` reverts due to the paused token.
4. Pause lasts longer than the remaining escrow period.
5. After unpause, `block.timestamp >= releaseAt`, so `refund()` is now permanently blocked.
6. Seller's only option is `release()`, even if a refund was warranted.

**Recommendation**: Allow the owner to extend escrow deadlines during token pauses, or track a "pause-adjusted" release time. Alternatively, accept this as an inherent risk but document it clearly for sellers and buyers.
