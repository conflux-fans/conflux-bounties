# X402PaymentVerifier -- ERC20 Weird-Token Audit Findings

**Contract**: `X402PaymentVerifier.sol`
**Date**: 2026-04-02
**Checklist**: Weird ERC20 Token Security Checklist

---

## [ERC20-1] Fee-on-transfer tokens bypass balance-difference check for escrowed accounting but not for future releases
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()` (line 296-307) and contract NatSpec (line 11-13)
**Description**: The contract correctly uses the `balanceAfter - balanceBefore` pattern in `settle()` (line 296-306) to record the actual received amount rather than the nominal `value` parameter. This means `payments[invoiceId].amount` reflects the real tokens held. However, the contract's NatSpec (line 11-13 of IERC3009) and `setSupportedToken()` documentation (line 416-418) state that only non-fee-on-transfer tokens should be registered. If an owner mistakenly adds a fee-on-transfer token, the balance-difference check would still produce correct accounting, but the payer would receive fewer tokens back on refund than they originally sent (the fee is taken twice -- once on inbound transfer, once on outbound). This is a design-level caveat rather than a code bug.
**Proof of Concept**: 1. Owner adds a 1% fee-on-transfer token. 2. Payer authorizes 100 tokens. 3. `settle()` executes: contract receives 99 tokens, records `amount = 99`. 4. Seller calls `refund()`: contract sends 99 tokens, payer receives ~98.01. Payer loses ~2 tokens total.
**Recommendation**: The documentation-based mitigation is adequate. For defense-in-depth, consider adding an explicit on-chain check that `received == value` to reject fee-on-transfer tokens at settlement time:
```solidity
require(received == value, "X402: fee-on-transfer tokens not supported");
```

---

## [ERC20-2] Rebasing tokens will cause accounting drift for escrowed funds
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `Payment.amount` field, `release()` (line 334-349), `_refundTo()` (line 394-411)
**Description**: If a rebasing token (e.g., stETH, AMPL) is added as a supported token, the contract records `amount` at settlement time but the actual token balance held by the contract may increase or decrease due to rebases. On a negative rebase, `release()` or `refund()` could attempt to transfer more tokens than the contract holds, causing a revert and permanently locking the payment (neither releasable nor refundable). On a positive rebase, excess tokens accumulate in the contract with no mechanism to withdraw them. The NatSpec warns against rebasing tokens, but there is no on-chain enforcement.
**Proof of Concept**: 1. Owner adds a rebasing token. 2. Settle a payment for 1000 tokens. 3. A negative rebase reduces the contract's balance to 950. 4. `release()` calls `safeTransfer(recipient, 1000)` which reverts. 5. The payment is stuck: it cannot be released (insufficient balance) and the escrow period may have passed (preventing refund).
**Recommendation**: Either enforce a token whitelist more strictly (e.g., store a hash of approved token addresses at deploy time with no runtime additions), or add a safety cap in `release()` and `_refundTo()`:
```solidity
uint256 bal = IERC20(token).balanceOf(address(this));
uint256 transferAmount = amount > bal ? bal : amount;
IERC20(token).safeTransfer(recipient, transferAmount);
```
Alternatively, rely on the existing admin-only `setSupportedToken` guard and document this risk prominently.

---

## [ERC20-3] Tokens with blocklists can permanently lock escrowed funds
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `release()` (line 348), `_refundTo()` (line 409)
**Description**: If the payment recipient (seller) or the payer gets added to a token blocklist (e.g., USDC, USDT) after settlement but before release/refund, the `safeTransfer` call will revert permanently. The payment will be stuck in escrow with no recovery path. The `refundTo()` function (line 389) partially mitigates this for refunds by allowing an alternative refund address, but there is no equivalent mechanism for releases -- `release()` always sends to `p.recipient` with no override.
**Proof of Concept**: 1. Seller settles a USDC payment. 2. Seller's wallet gets blocklisted by Circle. 3. After escrow period, anyone calls `release()`. 4. `IERC20(token).safeTransfer(recipient, amount)` reverts because `recipient` is blocklisted. 5. Escrow period has passed, so `refund()` also reverts (`block.timestamp < p.releaseAt` check fails). 6. Funds are permanently locked.
**Recommendation**: Add a `releaseTo()` function that allows the seller to specify an alternative release address, or add an owner-override for stuck payments:
```solidity
function releaseTo(bytes32 invoiceId, address to) external nonReentrant {
    Payment storage p = payments[invoiceId];
    require(p.paidAt > 0, "X402: invoice not paid");
    require(!p.released, "X402: already released");
    require(!p.refunded, "X402: already refunded");
    require(block.timestamp >= p.releaseAt, "X402: escrow period active");
    require(msg.sender == p.recipient, "X402: only recipient can redirect");
    require(to != address(0), "X402: zero address");

    p.released = true;
    IERC20(p.token).safeTransfer(to, p.amount);
    emit PaymentReleased(invoiceId, to, p.token, p.amount);
}
```

---

## [ERC20-4] Token transfer pause can prevent release after escrow, with no fallback
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `release()` (line 334-349), `_refundTo()` (line 394-411)
**Description**: If a supported token (e.g., USDC, USDT) has its transfers paused by the token issuer, both `release()` and `_refundTo()` will revert. Unlike the blocklist scenario, this is temporary -- transfers will resume when unpaused. However, during the pause, the escrow period may expire, preventing refunds that should have been possible. There is no mechanism to extend the escrow deadline when transfers are paused.
**Proof of Concept**: 1. Payment settled with 23-hour escrow. 2. At hour 20, seller decides to refund. 3. Token is paused at this moment. 4. Token unpauses at hour 25. 5. Refund attempt fails: `block.timestamp < p.releaseAt` is now false. 6. Funds are released to seller against intended refund.
**Recommendation**: This is a known limitation of working with pausable tokens. Consider documenting this risk. For higher assurance, allow the seller to mark a payment as "refund-pending" during escrow, which would block release even after the escrow period ends, giving a window after unpause to complete the refund.

---

## [ERC20-5] No SafeERC20 usage for the ERC-3009 `receiveWithAuthorization` call
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()` (line 297-305)
**Description**: The contract uses OpenZeppelin's `SafeERC20` for `safeTransfer` calls in `release()` and `_refundTo()`, but the `receiveWithAuthorization()` call on line 297 is made via the raw `IERC3009` interface without safe-call wrapping. If the ERC-3009 implementation returns `false` instead of reverting on failure, the contract would not detect the failure. The balance-difference check on line 306-307 (`require(received > 0)`) acts as a secondary guard, so actual fund loss is unlikely. However, the call could silently succeed with no tokens transferred if the token has unusual return behavior and the contract already held tokens that were transferred by another path in the same transaction.
**Proof of Concept**: Unlikely in practice due to the balance-difference check, but a token with a non-reverting `receiveWithAuthorization` that returns false and transfers 0 tokens would pass the external call but be caught by `require(received > 0)`.
**Recommendation**: The existing balance-difference check is sufficient mitigation. No code change required, but for consistency, consider wrapping the call in a low-level call with return-value checking, or documenting why SafeERC20 is not used here (ERC-3009 is not part of the ERC-20 SafeERC20 wrappers).

---

## [ERC20-6] Seller-controlled `refundTo` allows redirecting escrowed funds to arbitrary address
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `refundTo()` (line 389-391)
**Description**: The `refundTo()` function allows the seller (payment recipient) to refund escrowed funds to any arbitrary address, not just the original payer. While this is intentionally designed to handle blocklisted payers, it creates a trust assumption: the seller can redirect a "refund" to their own address (or any address they control), effectively keeping the funds while marking the payment as refunded. This means the payer has no on-chain guarantee of receiving their refund. The seller could call `refundTo(invoiceId, sellerOwnAddress)` and the payer gets nothing while the payment shows as "refunded."
**Proof of Concept**: 1. Payer pays 1000 USDC to seller via `settle()`. 2. Seller calls `refundTo(invoiceId, sellerWallet)`. 3. Payment is marked `refunded = true`. 4. Seller receives 1000 USDC back. 5. Payer sees "refunded" status but received nothing. 6. `verifyPayment()` returns `(false, address(0))` so the payer cannot use the endpoint either.
**Recommendation**: Restrict `refundTo` so that it cannot send to the seller's own address or to the contract address. Alternatively, require the payer to co-sign alternative refund addresses:
```solidity
require(refundRecipient != p.recipient, "X402: cannot refund to seller");
```
At minimum, document this trust assumption clearly so payers understand the refund model relies on seller honesty.

---

## [ERC20-7] Escrow duration of zero allows immediate release, bypassing refund window
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `_validateEscrowDuration()` (line 471-476), `settle()` (line 319)
**Description**: `MIN_ESCROW_DURATION` is 0 and `_validateEscrowDuration` returns `DEFAULT_ESCROW_DURATION` (24 hours) when the input is 0. However, if a seller passes `escrowDuration = 1` (1 second), this passes validation and means `releaseAt = block.timestamp + 1`. In the same block (or the next), `release()` can be called, leaving virtually no time for refunds. The NatSpec says "0 = immediate release, no escrow" for `MIN_ESCROW_DURATION`, suggesting this is intentional, but it undermines the refund protection the escrow system provides.
**Proof of Concept**: 1. Seller registers with `escrowDuration = 1`. 2. Settle a payment in block N. 3. In block N+1 (or even block N if timestamp advances), call `release()`. 4. Payer has no practical window to request a refund.
**Recommendation**: Set `MIN_ESCROW_DURATION` to a meaningful minimum (e.g., 1 hour) to ensure payers always have a refund window:
```solidity
uint256 public constant MIN_ESCROW_DURATION = 1 hours;
```

---

## [ERC20-8] Duplicate token addresses in constructor are silently accepted
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `constructor()` (line 132-139)
**Description**: The constructor accepts an array of token addresses and iterates through them, setting `supportedTokens[token] = true` for each. If the same address appears multiple times, it is silently accepted and the `TokenSupported` event is emitted multiple times for the same token. This is not a security issue but could confuse off-chain indexers or monitoring systems.
**Proof of Concept**: Deploy with `_tokens = [USDC, USDC]`. Two `TokenSupported` events are emitted for USDC.
**Recommendation**: Add a duplicate check:
```solidity
require(!supportedTokens[_tokens[i]], "X402: duplicate token");
```

---

## [ERC20-9] No emergency withdrawal mechanism for stuck tokens
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: Contract-wide
**Description**: The contract has no mechanism for the owner to withdraw tokens that are stuck due to edge cases (blocklisted recipients, paused tokens, rebasing losses, or tokens accidentally sent directly to the contract). If tokens become permanently unrecoverable through normal `release()` or `refund()` paths, there is no fallback. This is a deliberate design choice (avoiding owner trust assumptions) but creates permanent fund loss risk in edge cases.
**Proof of Concept**: 1. Someone accidentally sends 1000 USDC directly to the contract (not via `settle()`). 2. These tokens are permanently locked with no recovery mechanism. Or: a payment gets stuck due to blocklist (see ERC20-3) with no owner override.
**Recommendation**: Consider adding a time-locked emergency withdrawal that can only recover tokens not accounted for in active escrows:
```solidity
function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
    // Only withdraw surplus tokens not tied to active escrows
    IERC20(token).safeTransfer(owner(), amount);
}
```
This does introduce owner trust, so it should be paired with a timelock or multisig requirement.

---

## [ERC20-10] `received > 0` check in settle() is redundant but masks a potential zero-transfer DoS vector
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `settle()` (line 307)
**Description**: The contract checks `require(value > 0)` on line 278 and then checks `require(received > 0)` on line 307. If `receiveWithAuthorization` succeeds, the received amount should equal `value` for non-fee-on-transfer tokens. For tokens that revert on zero-amount transfers (like LEND or BNB), the `value > 0` check already prevents reaching the transfer call with a zero amount. The `received > 0` check is a good defense-in-depth measure but is functionally redundant for well-behaved tokens.
**Proof of Concept**: N/A -- informational only.
**Recommendation**: No change needed. The defense-in-depth is appropriate.

---

## [ERC20-11] ERC-3009 `receiveWithAuthorization` uses ECDSA (v, r, s) only -- no EIP-1271 or EIP-2098 support
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `settle()` (line 263-275), `IERC3009` interface (line 15-28)
**Description**: The `IERC3009` interface and `settle()` function only accept ECDSA signatures via `(v, r, s)` parameters. This means smart contract wallets (which use EIP-1271 for signature validation) cannot authorize payments. This is a limitation of the ERC-3009 standard itself, not a bug in this contract, but it restricts the user base to EOA wallets only.
**Proof of Concept**: A user with a Gnosis Safe or other smart contract wallet cannot sign an ERC-3009 authorization.
**Recommendation**: Document this limitation. If smart contract wallet support is desired, consider adding an alternative settlement path using ERC-20 `permit` (ERC-2612) + `transferFrom`, or standard `transferFrom` with pre-approval.

---

*End of findings. All other checklist items (multiple-address tokens, flash-mintable tokens, admin minting, USDT approve race condition, BNB zero-approval revert, infinite approval drain, missing return values, Solmate SafeTransferLib, decimal quirks, ERC-777/ERC-677 hooks, permit edge cases, upgradeable tokens, Gnosis chain callbacks, phantom functions, non-string metadata, cUSDCv3 max-transfer, native currency ERC-20, UNI/COMP uint96, DSToken transferFrom) were reviewed and found either not applicable to this contract or already mitigated by existing design choices (SafeERC20 usage, owner-controlled token allowlist, no approval management, no price/share calculations, no cross-chain logic, no permit usage, documented restrictions in NatSpec).*
