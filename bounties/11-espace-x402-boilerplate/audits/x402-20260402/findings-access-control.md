# Access Control Audit Findings -- X402PaymentVerifier.sol

**Contract**: `X402PaymentVerifier.sol`
**Date**: 2026-04-02
**Checklist**: evm-audit-access-control

---

## [AC-01] Buyer has no on-chain refund capability -- refund is seller-only
**Severity**: High
**Category**: evm-audit-access-control
**Location**: `_refundTo()`, `refund()`, `refundTo()`
**Description**: All refund paths require `msg.sender == p.recipient` (the seller). The buyer (payer) has zero on-chain ability to dispute or request a refund. If a seller accepts payment via `settle()` and never delivers the service, the buyer's only recourse is to wait for the escrow period to end -- at which point `release()` sends funds to the seller. This is a fundamental trust model violation in a multi-agent system: the party who should have recourse (the buyer) has none, while the party who already received the commitment (the seller) holds unilateral refund power.
**Proof of Concept**:
1. Buyer authorizes a payment that gets settled by the seller.
2. Seller never delivers the API service.
3. Buyer cannot call `refund()` or `refundTo()` because both check `msg.sender == p.recipient`.
4. After `releaseAt`, anyone calls `release()` and the seller receives the funds.
**Recommendation**: Introduce a buyer-initiated dispute mechanism with a timeout or an arbiter role. For example, allow the buyer to flag a dispute during the escrow period, which pauses release and requires owner or arbiter resolution.

---

## [AC-02] releaseTo() may lack escrow period and release-state checks
**Severity**: High
**Category**: evm-audit-access-control
**Location**: `releaseTo()`
**Description**: The `releaseTo()` function only visibly checks `msg.sender == p.recipient` but the provided code does not show checks for `p.released`, `p.refunded`, or `block.timestamp >= p.releaseAt`. If the full implementation mirrors only the visible access check, the recipient could redirect funds before the escrow period ends (bypassing the escrow entirely) or call it on already-released/refunded payments (double-spend). The comment says "transfers to alternative address" without showing the guards that `release()` has.
**Proof of Concept**:
1. Payment is settled with 24-hour escrow.
2. Immediately, seller calls `releaseTo(invoiceId, sellerAltAddress)`.
3. If no escrow check exists in the full implementation, funds are transferred immediately, bypassing the escrow and eliminating the refund window.
**Recommendation**: Ensure `releaseTo()` includes all the same guards as `release()`: check `!p.released`, `!p.refunded`, `block.timestamp >= p.releaseAt`, and set `p.released = true`. Audit the full implementation to confirm these guards exist.

---

## [AC-03] Seller can redirect refunds to arbitrary address via refundTo()
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `refundTo()`
**Description**: The `refundTo()` function allows the seller (payment recipient) to refund escrowed funds to any arbitrary address, not just the original payer. The only restriction is that the refund cannot go to `p.recipient` (the seller themselves). A malicious seller could settle a payment (pulling funds from the payer into escrow) and then immediately call `refundTo()` with an accomplice's address, effectively stealing the payer's funds under the guise of a "refund." The payer has no on-chain recourse once the funds are sent to the wrong address.
**Proof of Concept**:
1. Seller calls `settle()` with a valid ERC-3009 authorization from the payer, pulling 1000 USDC into escrow.
2. Seller immediately calls `refundTo(invoiceId, accompliceAddress)`.
3. The 1000 USDC is sent to `accompliceAddress` instead of back to the payer.
4. The payment is marked as `refunded = true`, so the payer cannot recover the funds.
**Recommendation**: Restrict `refundTo()` to require the payer's consent (e.g., an off-chain signature from the payer authorizing the alternate refund address), or limit the alternate address to be set by the payer, not the seller.

---

## [AC-04] Owner can remove supported tokens instantly without timelock, inconsistent with token addition
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `removeToken()`
**Description**: `removeToken()` is `onlyOwner` with no timelock, in contrast to `proposeToken()` / `activateToken()` which enforce a 48-hour `TOKEN_ACTIVATION_DELAY`. While removing a token does not directly prevent `release()` or `refund()` on existing escrows (those use `safeTransfer` on the stored `p.token`), the asymmetric timelock approach is a governance gap. A compromised or malicious owner can instantly block all new settlements for a token. If any future logic adds a `supportedTokens[p.token]` check during release/refund flows, existing escrows would break.
**Proof of Concept**:
1. Token X is supported with active escrows.
2. Owner calls `removeToken(tokenX)` -- instant effect, no timelock.
3. New settlements in token X are immediately blocked.
4. Sellers relying on token X for their business are disrupted without warning.
**Recommendation**: Apply the same timelock pattern to `removeToken()` as is used for `proposeToken()`, or at minimum emit an event and enforce a delay before removal takes effect.

---

## [AC-05] Owner can change registration fee instantly with no timelock or cap
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `setRegistrationFee()`
**Description**: `setRegistrationFee()` is `onlyOwner` with no timelock, no upper bound, and no event emission. The owner can set an arbitrarily high fee to effectively block new seller registrations or reactivations, or front-run a pending `registerSeller` transaction by raising the fee.
**Proof of Concept**:
1. Registration fee is 0.01 CFX.
2. A seller submits `registerSeller()` with `msg.value = 0.01 CFX`.
3. Owner front-runs with `setRegistrationFee(100 CFX)`.
4. Seller's transaction reverts with "insufficient registration fee".
**Recommendation**: Add a timelock to `setRegistrationFee()` changes, impose a reasonable upper bound, and emit an event on fee changes.

---

## [AC-06] Seller can set escrow duration to zero, eliminating the refund window entirely
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `_validateEscrowDuration()`, `registerSeller()`
**Description**: `MIN_ESCROW_DURATION` is defined as `0` and `_validateEscrowDuration()` only checks `duration <= MAX_ESCROW_DURATION`. A seller can register with `escrowDuration = 0`, meaning `releaseAt = paidAt` and `release()` is immediately callable. Since `_refundTo()` requires `block.timestamp < p.releaseAt`, the refund window is zero -- refunds become impossible from the moment of settlement. This effectively bypasses the escrow protection model.
**Proof of Concept**:
1. Seller calls `registerSeller("url", "desc", 0)`.
2. Seller settles a payment. `releaseAt = block.timestamp + 0`.
3. In the same block (or the next), anyone calls `release()`.
4. Even the seller cannot call `refund()` because `block.timestamp < p.releaseAt` is already false.
**Recommendation**: Enforce a meaningful minimum escrow duration (e.g., `MIN_ESCROW_DURATION = 1 hours`) in `_validateEscrowDuration()`.

---

## [AC-07] Seller can set escrow to 30 days, trapping buyer funds with no buyer recourse
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `_validateEscrowDuration()`, `MAX_ESCROW_DURATION`
**Description**: A seller can set `escrowDuration` up to `MAX_ESCROW_DURATION = 30 days`. During this period, buyer funds are locked in the contract. Combined with AC-01 (buyer cannot initiate refund), a malicious or negligent seller can hold buyer funds hostage for 30 days while the buyer has no recourse.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 30 days`.
2. Buyer's payment is settled.
3. Buyer cannot call refund. `release()` reverts with "escrow period active" for 30 days.
4. Buyer funds are inaccessible for the full 30-day period.
**Recommendation**: Either reduce `MAX_ESCROW_DURATION` to a more reasonable value (e.g., 7 days), or allow the buyer to initiate release after a shorter grace period, or expose escrow duration to buyers before authorization.

---

## [AC-08] Owner can deactivate any seller while payments are in escrow
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `deactivateSeller()`
**Description**: The contract owner can call `deactivateSeller(wallet)` for any active seller instantly. While escrowed funds remain releasable after deactivation (since `release()` does not check seller active status), any in-flight ERC-3009 authorizations from buyers targeting this seller can no longer be settled (`sellers[recipient].active` check in `settle()` will fail). The seller has no advance warning or time to complete pending business. The deactivated seller with pending escrows occupies an ambiguous state.
**Proof of Concept**:
1. Seller has 5 active escrows and 3 pending authorizations from buyers.
2. Owner calls `deactivateSeller(seller)`.
3. The 3 pending authorizations can no longer be settled.
4. Existing escrows are still releasable but the seller is in an inconsistent state.
**Recommendation**: Add a deactivation delay (e.g., 24-48 hours) for owner-initiated deactivations, allowing the seller to complete pending settlements. Self-deactivation by the seller can remain instant.

---

## [AC-09] Registration fee overpayment is silently kept -- excess not refunded
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `registerSeller()`, `reactivateSeller()`
**Description**: Both `registerSeller()` and `reactivateSeller()` check `msg.value >= registrationFee` but do not refund any excess. If a user sends more than the required fee (e.g., due to a UI bug, fee change between tx submission and mining, or misunderstanding), the surplus is retained by the contract and later withdrawn by the owner via `withdrawFees()`.
**Proof of Concept**:
1. `registrationFee` is 0.01 CFX.
2. Seller calls `registerSeller()` with `msg.value = 1 CFX`.
3. 0.99 CFX excess is silently kept in the contract.
4. Owner calls `withdrawFees()` and takes the excess.
**Recommendation**: Refund the excess: `if (msg.value > registrationFee) { payable(msg.sender).transfer(msg.value - registrationFee); }`. Alternatively, use `require(msg.value == registrationFee)` for strict matching.

---

## [AC-10] release() is fully permissionless -- third parties can front-run seller's intended refund
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `release()`
**Description**: `release()` has no caller restriction -- anyone can call it once `block.timestamp >= p.releaseAt`. While funds always go to the recorded `p.recipient`, this means a third party or MEV bot can trigger release at the exact moment the escrow expires, front-running a seller who intended to call `refundTo()` but whose transaction arrives in the same block or slightly later.
**Proof of Concept**:
1. Seller intends to call `refundTo()` to refund the buyer (e.g., service was not delivered).
2. At the exact block where `releaseAt` is reached, a bot calls `release()`.
3. The refund is now impossible because `released = true`.
4. Buyer loses funds even though the seller intended to refund.
**Recommendation**: Restrict `release()` to only the recipient (seller) or the payer (buyer), or add a short grace period after `releaseAt` where only the recipient can trigger release before it becomes permissionless.

---

## [AC-11] Seller can change escrow duration without notice, affecting future buyer expectations
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `updateSeller()`
**Description**: A seller can call `updateSeller()` at any time to change their `escrowDuration` with no event emitted and no delay enforced. While this only affects future settlements (existing payments retain their recorded `releaseAt`), a seller could set a long escrow to appear trustworthy, attract buyers, then change to zero-escrow before settling the next payment. The buyer's ERC-3009 authorization is signed off-chain with no awareness of the escrow parameter at settlement time.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 24 hours` (appears safe).
2. Buyer reviews on-chain state and authorizes payment.
3. Before settling, seller calls `updateSeller()` with `escrowDuration = 0`.
4. Seller calls `settle()` -- payment is settled with zero escrow, immediately releasable.
**Recommendation**: Emit an event on escrow duration changes. Consider enforcing a delay on escrow duration reductions, or have `settle()` accept an expected escrow duration parameter so the buyer's authorization can encode their expectation.

---

## [AC-12] Owner can withdraw all native balance including accidental sends and overpayments
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `withdrawFees()`
**Description**: `withdrawFees()` sends the entire native balance (`address(this).balance`) to the owner. There is no accounting of how much is legitimately collected fees versus accidentally sent native tokens. Combined with AC-09 (excess fees not refunded), this creates a minor value extraction vector.
**Proof of Concept**:
1. Multiple sellers overpay registration fees.
2. Someone accidentally sends 10 CFX to the contract.
3. Owner calls `withdrawFees()` and receives all accumulated balance including overpayments and accidental sends.
**Recommendation**: Track collected fees in a state variable and only allow withdrawal of the tracked amount.

---

## [AC-13] Compromised owner can disable all token support and grief the protocol
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `removeToken()`, `deactivateSeller()`
**Description**: If the single owner key is compromised, the attacker can: (a) remove all supported tokens via `removeToken()`, blocking all new settlements; (b) deactivate all sellers via `deactivateSeller()`. While the attacker cannot drain escrowed ERC-20 funds directly, they can permanently DoS the protocol. The contract uses `Ownable2Step` which mitigates accidental transfer, but does not mitigate key compromise. No multisig requirement is enforced on-chain.
**Proof of Concept**:
1. Attacker compromises the owner private key.
2. Attacker calls `removeToken(token)` for every supported token.
3. Attacker calls `deactivateSeller(wallet)` for every active seller.
4. No new payments can be settled. The protocol is effectively bricked for new business.
**Recommendation**: Deploy with a multisig (e.g., Gnosis Safe) as owner. Consider adding a timelock contract between the multisig and the verifier for critical admin operations.

---

## [AC-14] reactivateSeller() pushes to sellerList without verifying absence -- fragile array management
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `reactivateSeller()`
**Description**: When a seller is deactivated via `deactivateSeller()`, their entry is removed from `sellerList` and `_sellerIndex` is deleted. When `reactivateSeller()` is called, it pushes the seller to `sellerList` again with a new index. The `!active` guard currently prevents duplicates, but the pattern of managing an array with swap-and-pop plus re-insertion is error-prone for future modifications. If a code change removes or weakens the active check, duplicate entries could corrupt the seller list.
**Proof of Concept**: Under current logic this is guarded by the `!active` check. The finding is about fragility of the pattern for future maintenance.
**Recommendation**: Add an explicit check that the seller is not already in `sellerList` before pushing, as a defense-in-depth measure.

---

## [AC-15] settle() is seller-only -- buyers cannot self-settle
**Severity**: Info
**Category**: evm-audit-access-control
**Location**: `settle()`
**Description**: `settle()` requires `msg.sender == recipient`, meaning only the seller can trigger settlement. The buyer who signed the ERC-3009 authorization cannot initiate settlement themselves. If a seller goes offline after the buyer has signed an authorization, the authorization remains valid until `validBefore` but cannot be executed by the buyer.
**Proof of Concept**:
1. Buyer signs an ERC-3009 authorization for seller.
2. Seller's infrastructure goes down.
3. Buyer cannot call `settle()` because `msg.sender != recipient`.
4. Authorization expires unused.
**Recommendation**: This is an acceptable design trade-off for the x402 protocol pattern. Document that settlement is seller-initiated and ensure clients handle authorization expiry gracefully.

---

## [AC-16] Ownable2Step is correctly used but ownership transfer has no timelock
**Severity**: Info
**Category**: evm-audit-access-control
**Location**: constructor, `Ownable2Step` inheritance, `renounceOwnership()`
**Description**: The contract correctly uses `Ownable2Step` (two-step ownership transfer) and disables `renounceOwnership()`. This is good practice. However, ownership transfer changes the trust model for all admin functions (`removeToken`, `setRegistrationFee`, `withdrawFees`, `deactivateSeller`) and has no on-chain delay or multi-sig requirement.
**Proof of Concept**: Not a vulnerability -- informational note on governance posture.
**Recommendation**: Deploy with a multi-sig or governance contract as the initial owner. Monitor `OwnershipTransferStarted` and `OwnershipTransferred` events.

---

## [AC-17] No event emitted on escrow duration or registration fee changes
**Severity**: Info
**Category**: evm-audit-access-control
**Location**: `updateSeller()`, `reactivateSeller()`, `setRegistrationFee()`
**Description**: When a seller changes their `escrowDuration` via `updateSeller()` or `reactivateSeller()`, or when the owner changes `registrationFee`, no event includes the changed parameter values. Off-chain monitoring systems cannot detect these changes without parsing storage diffs.
**Proof of Concept**: A seller calls `updateSeller("url", "desc", 1)`. No event captures the escrow duration change.
**Recommendation**: Include escrow duration in seller events. Add a dedicated event for `setRegistrationFee()` that logs the old and new fee values.
