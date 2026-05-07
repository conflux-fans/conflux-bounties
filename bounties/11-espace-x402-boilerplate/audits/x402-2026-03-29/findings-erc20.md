# ERC20 Token Integration Audit Findings

**Contracts**: `X402PaymentVerifier.sol`, `MockUSDT0.sol`
**Date**: 2026-03-29
**Checklist**: evm-audit-erc20

---

## [ERC20-1] Fee-on-transfer tokens cause underpayment to recipient
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: The `settle()` function records `value` as the payment amount in the `Payment` struct, then calls `transferWithAuthorization` for the same `value`. If a fee-on-transfer token is added to `supportedTokens`, the recipient receives less than `value`, but the contract records the full `value` as `p.amount`. A subsequent `refund()` would then attempt to transfer back the full recorded amount, which exceeds what the recipient actually received, causing the refund to either fail or drain extra tokens from the recipient.
**Proof of Concept**:
1. Owner adds a 1% fee-on-transfer token to `supportedTokens`.
2. Payer settles an invoice for 1000 tokens. Recipient receives 990 tokens. `p.amount` is stored as 1000.
3. Recipient calls `refund()`. `safeTransferFrom(recipient, payer, 1000)` attempts to pull 1000 tokens from the recipient, but they only have 990 from this payment.
**Recommendation**: Either (a) document and enforce that only non-fee-on-transfer tokens may be added to `supportedTokens`, or (b) measure actual balance changes:
```solidity
uint256 balBefore = IERC20(token).balanceOf(recipient);
IERC3009(token).transferWithAuthorization(from, recipient, value, ...);
uint256 received = IERC20(token).balanceOf(recipient) - balBefore;
// store received instead of value
```

---

## [ERC20-2] Rebasing tokens cause accounting mismatch
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `settle()`, `refund()`
**Description**: Rebasing tokens (stETH, AMPL, aTokens) change holder balances over time. The contract stores a fixed `p.amount` at settlement time. If the token rebases downward, the recipient may no longer hold enough to cover the recorded refund amount. If it rebases upward, the refund returns the original nominal amount rather than the current value, creating an accounting discrepancy.
**Proof of Concept**:
1. Payer settles 1000 stETH to recipient.
2. A negative rebase reduces the recipient's balance to 950.
3. `refund()` tries `safeTransferFrom(recipient, payer, 1000)` and reverts because the recipient only holds 950.
**Recommendation**: Do not add rebasing tokens to `supportedTokens`. Add a comment or NatSpec annotation on `setSupportedToken` warning that only non-rebasing, non-fee-on-transfer tokens should be supported.

---

## [ERC20-3] Tokens with blocklists can permanently lock payment state
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `settle()`, `refund()`
**Description**: Tokens like USDC and USDT have admin-controlled blocklists. If the payer or recipient is blocklisted after a payment is settled, the `refund()` call will permanently revert because `safeTransferFrom` will fail. The payment record remains with `amount > 0` but can never be refunded, and there is no mechanism to handle this edge case.
**Proof of Concept**:
1. Payer settles an invoice paying 1000 USDC to recipient.
2. The payer's address is subsequently added to the USDC blocklist.
3. Recipient calls `refund()`. The `safeTransferFrom(recipient, payer, 1000)` reverts because the payer is blocklisted.
4. The payment is stuck: it cannot be refunded and `p.amount` remains nonzero.
**Recommendation**: Consider adding an alternative refund destination or an admin override that allows redirecting refunds to a different address when the original payer is unreachable.

---

## [ERC20-4] Tokens with transfer pausing can DOS settle and refund
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()`, `refund()`
**Description**: If a supported token has admin-controlled transfer pausing (e.g., USDC, USDT), both `settle()` and `refund()` become non-functional while the token is paused. This is a temporary DoS and is largely outside the contract's control, but the contract does not account for this possibility.
**Proof of Concept**:
1. Token admin pauses transfers.
2. All `settle()` and `refund()` calls for that token revert until unpaused.
**Recommendation**: This is an inherent property of pausable tokens. Document the risk. Optionally, add a time-locked emergency mechanism that allows the owner to mark invoices as disputed when transfers are blocked.

---

## [ERC20-5] Refund relies on recipient approval -- infinite approval drain risk
**Severity**: High
**Category**: evm-audit-erc20
**Location**: `refund()`
**Description**: The `refund()` function calls `IERC20(token).safeTransferFrom(recipient, payer, amount)`, which requires the recipient to have approved the `X402PaymentVerifier` contract to spend their tokens. If the recipient grants an infinite (type(uint256).max) approval to the verifier for convenience, any future payment to that recipient can be refunded by the contract owner at any time (since `msg.sender == owner()` is authorized), draining tokens from the recipient without their consent. The owner can also refund payments that the recipient does not wish to refund.
**Proof of Concept**:
1. Recipient approves `X402PaymentVerifier` for `type(uint256).max` of USDC.
2. Multiple payers settle invoices with the recipient, who accumulates a large USDC balance.
3. Contract owner calls `refund(invoiceId)` for each settled invoice, pulling the full amounts from the recipient back to payers.
4. The recipient loses funds they legitimately earned, without their consent.
**Recommendation**: Remove the `owner()` authorization from `refund()`, so only the recipient can initiate a refund. Alternatively, require both the recipient and owner to approve refunds (two-step process), or implement a pull-based refund where the recipient explicitly sends tokens rather than having them pulled.
```solidity
// Remove owner bypass:
require(msg.sender == p.recipient, "X402: not authorized to refund");
```

---

## [ERC20-6] Missing return value handling on ERC-3009 transferWithAuthorization
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: The `IERC3009` interface declares `transferWithAuthorization` as returning `void`, which matches the ERC-3009 specification. However, some token implementations (particularly older USDT-style tokens) may not follow the standard interface precisely. The contract does not check the success of the `transferWithAuthorization` call beyond relying on revert behavior. If a non-reverting token implementation returns `false` on failure, the payment would be recorded as settled without funds actually transferring. Note: this is mitigated by the fact that `transferWithAuthorization` per ERC-3009 is defined as reverting on failure, but the risk exists if a non-conforming token is added.
**Proof of Concept**:
1. A non-conforming token is added to `supportedTokens` where `transferWithAuthorization` returns `false` instead of reverting.
2. `settle()` records the payment as completed even though no transfer occurred.
**Recommendation**: Wrap the external call in a low-level call and check the return value, or document that only fully ERC-3009-compliant tokens should be added. Consider using a similar pattern to `SafeERC20` for the authorization call.

---

## [ERC20-7] MockUSDT0 has unrestricted public mint function
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `MockUSDT0.mint()`
**Description**: The `mint()` function in `MockUSDT0` has no access control. Anyone can mint arbitrary amounts of tokens to any address. While the contract is named "Mock" and is presumably intended for testing only, if it were deployed to a production environment (even accidentally), it would be trivially exploitable.
**Proof of Concept**:
1. Attacker calls `mint(attacker, 1_000_000e6)`.
2. Attacker now holds 1 million USDT0 tokens minted from nothing.
**Recommendation**: Add an `onlyOwner` modifier to the `mint()` function, or ensure this contract is never deployed outside of test environments. Consider adding a comment or NatSpec annotation explicitly marking it as test-only.

---

## [ERC20-8] Decimals assumptions -- tokens with 0 or >18 decimals
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: The `X402PaymentVerifier` contract treats `value` as an opaque uint256 and does not perform any decimal normalization or validation. While this means it is technically agnostic to decimals, off-chain systems generating invoices must correctly match the token's decimals. If a token with 0 decimals or >18 decimals is added to `supportedTokens`, off-chain invoice generation could easily produce incorrect amounts. The `MockUSDT0` uses 6 decimals, but nothing in the verifier enforces or records expected decimals.
**Proof of Concept**:
1. Owner adds a 0-decimal token to `supportedTokens`.
2. Off-chain system generates an invoice for "1.50 tokens" and encodes `value = 150` (assuming 2 decimals).
3. Actual transfer is for 150 whole tokens instead of 1.50.
**Recommendation**: Store the expected decimals for each supported token, or document the assumption that off-chain systems must correctly handle decimal conversion per token.

---

## [ERC20-9] ERC-777 tokens can reenter via transfer hooks
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: If an ERC-777 token (which is backwards-compatible with ERC-20) is added to `supportedTokens`, the `tokensReceived` hook on the recipient could be triggered during `transferWithAuthorization`. The `settle()` function does follow checks-effects-interactions by setting `usedNonces` and `payments` before the external call, and it uses `nonReentrant`. However, the `refund()` function could be reentered from a different context if the ERC-777 hook triggers a call chain. The `nonReentrant` modifier on both functions mitigates direct reentrancy, but cross-protocol reentrancy via ERC-777 hooks remains a concern in composable DeFi contexts.
**Proof of Concept**:
1. An ERC-777 token is added to `supportedTokens`.
2. Recipient is a contract with a `tokensReceived` hook.
3. During `settle()`, the hook fires and the recipient contract interacts with other protocols that read stale state from `X402PaymentVerifier`.
**Recommendation**: Document that ERC-777 tokens should not be added to `supportedTokens`. The `nonReentrant` guard already mitigates direct reentrancy into this contract's own functions.

---

## [ERC20-10] Transfer to self may revert for some tokens
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: Some tokens revert when `from == to` in a transfer. In `settle()`, there is no check preventing `from == recipient`. If a payer sets themselves as the recipient, `transferWithAuthorization(from, from, ...)` could revert on tokens that disallow self-transfers, causing confusing error messages. Even for tokens that allow it, paying yourself serves no practical purpose and wastes gas.
**Proof of Concept**:
1. Caller invokes `settle()` with `from == recipient` using a token that reverts on self-transfer.
2. Transaction reverts with an opaque error from the token contract.
**Recommendation**: Add a check: `require(from != recipient, "X402: self-payment")`.

---

## [ERC20-11] Multiple-address tokens can bypass nonce and invoice tracking
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: Some tokens have multiple entry-point addresses (e.g., proxy patterns where the old and new addresses both work, or SNX-style dual-address tokens). If such a token is added via one address but the `transferWithAuthorization` call succeeds via a different address that happens to implement the same interface, the `supportedTokens` check could be bypassed if the caller passes the registered address but the actual transfer uses a different code path. More practically, if both addresses are registered, the same underlying transfer could be recorded under different `token` addresses, leading to inconsistent accounting.
**Proof of Concept**:
1. Token has addresses A and B that both operate on the same underlying balance.
2. Owner adds both A and B to `supportedTokens`.
3. An invoice is settled via address A, recording `p.token = A`.
4. A refund is attempted but the recipient's balance is tracked under address B, causing confusion or failure.
**Recommendation**: Document that multi-address tokens must only have one canonical address registered. Consider adding a token registry that maps to canonical addresses.

---

## [ERC20-12] USDT approve race condition affects refund flow
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `refund()`
**Description**: The `refund()` function uses `safeTransferFrom(recipient, payer, amount)`, which requires the recipient to have approved the verifier contract. USDT on Ethereum requires the allowance to be set to 0 before it can be changed to a new nonzero value. If a recipient has a stale nonzero USDT approval to the verifier and needs to adjust it, the `approve()` call will revert. While `safeTransferFrom` itself doesn't call approve, the prerequisite approval step is problematic for USDT holders who need to manage their allowance to this contract.
**Proof of Concept**:
1. Recipient approves verifier for 1000 USDT.
2. A refund for 500 occurs, leaving 500 allowance.
3. Recipient tries to `approve(verifier, 2000)` to cover future refunds -- this reverts on USDT because the current allowance is nonzero.
4. Recipient must first `approve(verifier, 0)` then `approve(verifier, 2000)`.
**Recommendation**: This is a known USDT quirk that affects users interacting with the contract. Document the two-step approval requirement for USDT-like tokens. Alternatively, redesign refund to be push-based (recipient sends tokens) rather than pull-based (contract pulls tokens).

---

## [ERC20-13] MockUSDT0 does not validate ecrecover returns address(0) from malformed signatures
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `MockUSDT0.transferWithAuthorization()`
**Description**: The `MockUSDT0` contract correctly checks `recovered != address(0) && recovered == from`, which handles the case where `ecrecover` returns `address(0)` for invalid signatures. However, the `require` statement combines two conditions without descriptive error messages, making debugging difficult. This is a minor best-practice issue since the logic is correct.
**Proof of Concept**: N/A -- the check is functional but lacks descriptive revert reasons.
**Recommendation**: Add descriptive revert messages:
```solidity
require(recovered != address(0), "MockUSDT0: invalid signature");
require(recovered == from, "MockUSDT0: unauthorized");
```

---

## [ERC20-14] No validation that token actually implements ERC-3009
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `setSupportedToken()`, `settle()`
**Description**: The `setSupportedToken()` function accepts any address without verifying it implements the `IERC3009` interface. If a standard ERC-20 token without `transferWithAuthorization` is added, `settle()` will revert with an opaque low-level error when calling the nonexistent function, or worse, could hit a fallback function with unexpected behavior.
**Proof of Concept**:
1. Owner adds a standard ERC-20 token (no ERC-3009 support) to `supportedTokens`.
2. User calls `settle()` with that token.
3. The call to `transferWithAuthorization` either reverts with no message or triggers the token's fallback function.
**Recommendation**: Add an interface check in `setSupportedToken()` using ERC-165 `supportsInterface` if the token supports it, or attempt a static call to `authorizationState` to verify the interface exists.
