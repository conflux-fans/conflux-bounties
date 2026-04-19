# Precision & Math Audit Findings

**Audit Date**: 2026-03-29
**Category**: evm-audit-precision-math
**Contracts**: X402PaymentVerifier.sol, MockUSDT0.sol

---

## [PM-1] Off-by-one in MockUSDT0 time-bound comparisons excludes boundary timestamps
**Severity**: Low
**Category**: evm-audit-precision-math
**Location**: `MockUSDT0.transferWithAuthorization()` lines with `block.timestamp > validAfter` and `block.timestamp < validBefore`
**Description**: The MockUSDT0 contract uses strict inequality operators (`>` and `<`) for both `validAfter` and `validBefore` checks. This means an authorization cannot be used at exactly `block.timestamp == validAfter` or at `block.timestamp == validBefore`. The canonical ERC-3009 specification uses `require(block.timestamp > validAfter)` and `require(block.timestamp < validBefore)`, so the `validAfter` check matches the spec. However, the `validBefore` strict-less-than means if a caller sets `validBefore` to a specific deadline, the authorization becomes invalid one second earlier than the name "validBefore" intuitively suggests. While this matches the reference ERC-3009 implementation, callers integrating with this contract must be aware that `validBefore` is exclusive, not inclusive. If the X402 system generates `validBefore` values assuming inclusive behavior, payments could fail at the boundary timestamp.
**Proof of Concept**:
1. Payer signs authorization with `validBefore = T`.
2. Relayer submits `settle()` in a block where `block.timestamp == T`.
3. MockUSDT0 reverts with "USDT0: auth expired" because `T < T` is false.
**Recommendation**: This is consistent with ERC-3009 reference behavior, so no code change is strictly needed. Ensure off-chain systems set `validBefore` with sufficient margin (e.g., desired deadline + 1) to avoid edge-case failures. Document the exclusive nature of the boundary.

---

## [PM-2] Amount comparison in verifyPayment is decimal-unaware across different token types
**Severity**: Info
**Category**: evm-audit-precision-math
**Location**: `verifyPayment()` - `if (p.amount < expectedAmount)`
**Description**: The `verifyPayment` function compares `p.amount` against `expectedAmount` as raw `uint256` values with no awareness of the token's `decimals()`. The contract supports arbitrary ERC-20 tokens (via `supportedTokens`), which may have different decimal places (e.g., USDT0 has 6 decimals, while a standard ERC-20 may have 18). If the caller of `verifyPayment` passes `expectedAmount` scaled to a different decimal base than the token used for the original payment, the comparison will produce incorrect results. For example, expecting 1.00 USDT expressed as `1e18` when the actual stored amount is `1e6` would always return `(false, address(0))`.
**Proof of Concept**:
1. Payment is settled for 1 USDT0 (6 decimals): `amount = 1_000_000`.
2. Off-chain system calls `verifyPayment(invoiceId, 1_000_000_000_000_000_000, endpoint)` using 18-decimal scaling.
3. `1_000_000 < 1_000_000_000_000_000_000` evaluates to true, so verification fails despite the payment being correct.
**Recommendation**: This is an integration concern rather than a contract bug -- the contract correctly stores and compares raw token amounts. Ensure off-chain callers always use the same decimal scaling as the payment token when calling `verifyPayment`. Consider adding a `token` field to the verification check or documenting that `expectedAmount` must be in the token's native decimals.

---

## Checklist Items Reviewed -- Not Applicable

The following checklist items were reviewed and found not applicable to these contracts:

| Checklist Item | Reason N/A |
|---|---|
| Division before multiplication | No division operations in either contract |
| Hidden division-before-multiplication in library calls | SafeERC20 does not perform division; no math libraries used |
| Extra divisions by scaling factor | No scaling factor arithmetic |
| Division resulting in zero for small values | No division operations |
| Protocol-favoring rounding rule | No rounding in any function |
| Inconsistent rounding across functions | No rounding in any function |
| Inverse fee calculation error | No fee calculations |
| Overflow in unchecked blocks | No `unchecked` blocks |
| Downcast overflow | No integer downcasts (MockUSDT0 `decimals()` returns a literal) |
| Negative-to-unsigned cast | No signed integer types used |
| Signed-unsigned addition/subtraction overflow | No signed integer arithmetic |
| Overflow in time-based calculations | `block.timestamp` stored directly, no timestamp arithmetic |
| Oracle decimal mismatch | No oracle integrations |
| Zero/one remaining after division | No division operations |
| Compounding vs simple interest | No interest calculations |
| Reward per token precision loss | No reward distribution logic |
| Special values (div-by-zero in assembly, max sentinel) | No assembly blocks, no `type(uint256).max` usage |
| Extreme weight ratios | No weight-based calculations |
| Solidity time literals are uint24 | No time literals (e.g., `1 days`) used |
