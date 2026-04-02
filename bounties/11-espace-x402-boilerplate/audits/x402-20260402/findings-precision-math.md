# Precision & Math Audit Findings -- X402PaymentVerifier

**Contract**: `X402PaymentVerifier.sol`
**Auditor**: Claude Opus 4.6
**Date**: 2026-04-02
**Checklist**: `evm-audit-precision-math`

---

## [MATH-1] Fee-on-transfer tokens cause permanent invoice burn with no minimum-received enforcement
**Severity**: Medium
**Category**: evm-audit-precision-math
**Location**: `settle()`
**Description**: The contract correctly uses a balance-difference pattern (`received = balanceOf(after) - balanceOf(before)`) to measure actual tokens received. However, `received` can be arbitrarily smaller than the `value` parameter. The payment is recorded with `amount: received`, but there is no way for the caller to specify a minimum acceptable amount. Once `settle()` executes, the `invoiceId` is permanently consumed and the payer's nonce is burned. If `verifyPayment()` is later called with the original `expectedAmount` (equal to `value`), it returns `false` because `received < expectedAmount`. The result is tokens locked in escrow under an invoice that can never pass verification, with no ability to re-settle the same invoice.
**Proof of Concept**:
1. A fee-on-transfer token is added to `supportedTokens`.
2. Payer authorizes 1000 tokens via ERC-3009.
3. Recipient calls `settle()` with `value=1000`.
4. Token takes a 5% transfer fee; only 950 arrive.
5. `payments[invoiceId].amount = 950`.
6. Application calls `verifyPayment(invoiceId, 1000, endpoint)` and gets `valid=false` because `950 < 1000`.
7. The payer's nonce is burned, the invoiceId is consumed, and 950 tokens sit in escrow with no path to successful verification at the expected amount.
**Recommendation**: Add a `minReceived` parameter to `settle()` and enforce `require(received >= minReceived, "X402: insufficient received")`. This lets the recipient revert atomically if the fee-on-transfer deduction makes the payment unacceptable.

---

## [MATH-2] Zero escrow duration makes refund window impossible and negates escrow guarantees
**Severity**: Medium
**Category**: evm-audit-precision-math
**Location**: `settle()` -- `releaseAt: block.timestamp + sellers[recipient].escrowDuration`
**Description**: `MIN_ESCROW_DURATION` is defined as `0`. If a seller registers with `escrowDuration = 0`, then `releaseAt = block.timestamp + 0 = block.timestamp`. The `release()` function requires `block.timestamp >= p.releaseAt`, which is immediately satisfied in the same block. Meanwhile, `_refundTo()` requires `block.timestamp < p.releaseAt`, which is `block.timestamp < block.timestamp` -- always false. This means the refund path is permanently closed from the moment of settlement. The seller can settle and release in the same block (or even atomically via a contract that calls both), completely bypassing the escrow protection that is the contract's core security property.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 0`.
2. Payer authorizes payment.
3. Seller deploys a helper contract that calls `settle()` then `release()` in a single transaction.
4. Both succeed because `block.timestamp >= block.timestamp` is true.
5. Refund was never possible because `block.timestamp < block.timestamp` is always false.
**Recommendation**: Set `MIN_ESCROW_DURATION` to a meaningful non-zero value (e.g., `1 hours`) and enforce `require(duration >= MIN_ESCROW_DURATION)` in `_validateEscrowDuration()`.

---

## [MATH-3] Off-by-one at escrow boundary is correctly exclusive but undocumented
**Severity**: Low
**Category**: evm-audit-precision-math
**Location**: `release()` and `_refundTo()`
**Description**: The release function uses `block.timestamp >= p.releaseAt` (greater-than-or-equal) while refund uses `block.timestamp < p.releaseAt` (strict less-than). At the exact second `block.timestamp == p.releaseAt`, release is permitted and refund is not. There is no overlap and no gap -- the boundary is clean. However, the semantics are not documented, and on chains with variable block times (including Conflux eSpace), the exact boundary second is unpredictable. A seller who submits a refund transaction expecting it to land before `releaseAt` may find it mined exactly at `releaseAt`, causing an unexpected revert. In the same block, a front-runner or MEV bot could call `release()` instead.
**Proof of Concept**:
1. Payment settles at timestamp `T`, `escrowDuration = 3600`, so `releaseAt = T + 3600`.
2. At `block.timestamp = T + 3599`, seller submits `refund()` to the mempool.
3. Transaction is mined in a block with `block.timestamp = T + 3600`.
4. Refund reverts because `T + 3600 < T + 3600` is false.
5. In the same block, a release transaction succeeds.
**Recommendation**: Add NatSpec documentation clarifying the boundary semantics: "`releaseAt` is the first timestamp at which release is possible; refunds are only possible strictly before `releaseAt`." If the design intent is that the full escrow window includes `releaseAt` for refunds, change refund to `<=` and release to `>`.

---

## [MATH-4] No upper bound on payment value allows gross overpayment with no recourse
**Severity**: Low
**Category**: evm-audit-precision-math
**Location**: `settle()`, `verifyPayment()`
**Description**: The `verifyPayment` function uses `p.amount < expectedAmount` to reject underpayment, meaning any amount equal to or greater than `expectedAmount` passes. While accepting overpayment is common, the contract provides no mechanism for the payer to reclaim excess. If a payer authorizes 10000 tokens instead of 1000 (user error or malicious recipient manipulation of the `value` parameter), all 10000 enter escrow and are released to the recipient. The `settle()` function has no `maxAmount` or `expectedAmount` parameter to bound the transfer.
**Proof of Concept**:
1. Payer intends to pay 1000 USDC but signs authorization for 10000 USDC (typo or UI bug).
2. Recipient calls `settle()` with `value=10000`.
3. All 10000 tokens enter escrow with `amount=10000`.
4. `verifyPayment(invoiceId, 1000, endpoint)` returns `true` since `10000 >= 1000`.
5. After escrow, recipient releases 10000 to themselves; payer loses 9000 extra tokens.
**Recommendation**: Consider recording the intended payment amount and adding a tolerance check, or allowing the payer to specify a maximum authorized amount separate from the ERC-3009 value. Alternatively, add documentation that the payer's ERC-3009 authorization amount IS the payment amount and should match exactly.

---

## [MATH-5] `_validateEscrowDuration` is defined but never called -- escrow bounds may not be enforced
**Severity**: Medium
**Category**: evm-audit-precision-math
**Location**: `_validateEscrowDuration()`
**Description**: The internal function `_validateEscrowDuration()` enforces `duration <= MAX_ESCROW_DURATION` but is never called in the provided contract code. If the seller registration logic (not shown in the provided source) fails to call this function, a seller could set `escrowDuration` to an arbitrarily large value. With `escrowDuration` set to, for example, `type(uint256).max - block.timestamp`, the addition `block.timestamp + escrowDuration` in `settle()` would cause a revert due to Solidity 0.8 overflow protection, making the seller unable to receive any payments. With a large but non-overflowing value (e.g., `2^128`), funds would be locked for billions of years -- permanently inaccessible via `release()`, and only recoverable via `_refundTo()` (which only the recipient can call).
**Proof of Concept**:
1. Seller registration function (not in provided source) omits `_validateEscrowDuration()` call.
2. Seller sets `escrowDuration = 2^128`.
3. `settle()` computes `releaseAt = block.timestamp + 2^128` -- a timestamp far beyond any practical blockchain lifetime.
4. `release()` requires `block.timestamp >= releaseAt` -- impossible for billions of years.
5. Payer's funds are permanently locked unless the recipient calls `_refundTo()`.
**Recommendation**: Ensure all code paths that set or update `escrowDuration` call `_validateEscrowDuration()`. Without seeing the full contract, this cannot be verified from the provided source.

---

## [MATH-6] Dust payment amounts pass all checks, enabling invoice-slot griefing
**Severity**: Low
**Category**: evm-audit-precision-math
**Location**: `settle()`
**Description**: The only amount validation is `require(value > 0)` and `require(received > 0)`. A payment of 1 wei (the smallest possible unit for any ERC-20 token) passes both checks. Since `payments[invoiceId]` is keyed by `invoiceId` and the check `payments[invoiceId].paidAt == 0` prevents re-settlement, an attacker who knows or can predict invoice IDs could front-run legitimate settlements by settling the same `invoiceId` with a 1-wei dust payment. The legitimate payment would then revert with "X402: already paid". The `require(msg.sender == recipient)` check mitigates this for external attackers (only the registered seller-recipient can settle), but a malicious or compromised seller could grief their own invoices.
**Proof of Concept**:
1. Attacker is a registered seller (or has compromised a seller's key).
2. Legitimate payer creates authorization for invoiceId `0xABC` with `value=1000e6`.
3. Attacker calls `settle(0xABC, token, attackerAsFakeFrom, seller, 1, ...)` with a 1-wei authorization.
4. Invoice `0xABC` is now consumed with `amount=1`.
5. Legitimate settlement of `0xABC` reverts with "already paid".
**Recommendation**: Add a minimum payment amount per token, or allow invoice IDs to be namespaced such that only specific payer-recipient pairs can use them.

---

## [MATH-7] Time arithmetic overflow is safe due to Solidity 0.8 and bounded constants
**Severity**: Info
**Category**: evm-audit-precision-math
**Location**: `settle()` -- `block.timestamp + sellers[recipient].escrowDuration`, `block.timestamp + MAX_AUTH_DURATION`
**Description**: Both time-based additions use `uint256` arithmetic under Solidity 0.8's built-in overflow protection. `MAX_AUTH_DURATION = 7 days = 604,800` and `MAX_ESCROW_DURATION = 30 days = 2,592,000`. With realistic `block.timestamp` values (~1.7 billion for 2024), these additions are nowhere near `uint256` overflow. Even if `_validateEscrowDuration` is bypassed (see MATH-5), Solidity 0.8 would revert on overflow rather than silently wrapping.
**Proof of Concept**: N/A -- no vulnerability exists.
**Recommendation**: No action needed. Overflow protection is inherent in Solidity 0.8.

---

## Checklist items reviewed with no findings

The following precision-math checklist categories were reviewed and found **not applicable** to this contract:

| Category | Reason not applicable |
|---|---|
| Division before multiplication | No division operations in the contract |
| Hidden division-before-multiplication in library calls | No `mulDiv`/`wmul`/`wdiv` usage |
| Extra divisions by scaling factor | No scaling-factor arithmetic |
| Division resulting in zero for small values | No division operations |
| Protocol-favoring rounding direction | No vault/share/fee math |
| Inconsistent rounding across functions | No rounding operations |
| Inverse fee calculation error | No fee percentage calculations |
| Overflow in unchecked blocks | No `unchecked` blocks |
| Downcast overflow | No type downcasts; all values are `uint256`, `address`, `bool`, `bytes32`, `string` |
| Negative-to-unsigned cast | No signed integers |
| Signed-unsigned arithmetic overflow | No signed integers |
| Oracle decimal mismatch | No oracle integration |
| Token decimal mismatch in price calculations | No cross-token price math |
| Decimal scaling for vault assets | No vault math |
| Compounding vs simple interest | No interest accrual |
| Reward-per-token precision loss | No reward distribution |
| Fee shares minted after distribution | No shares or fee minting |
| Division by zero in assembly | No inline assembly |
| `type(uint256).max` as sentinel value | Not used as sentinel |
| Extreme weight ratio overflow | No weighted math |
| Precision loss compounding across operations | No chained arithmetic |
| Rounding down to zero allows free state changes | No division-based accounting |
