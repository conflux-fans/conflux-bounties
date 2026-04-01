# Access Control Audit Findings -- X402PaymentVerifier

**Contract**: `X402PaymentVerifier.sol`
**Date**: 2026-04-02
**Checklist**: evm-audit-access-control

---

## [AC-01] Instant token whitelist changes without timelock
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `setSupportedToken()` (line 420)
**Description**: The owner can instantly add or remove supported tokens via `setSupportedToken()` without any timelock or delay. Removing a supported token does not affect payments already in escrow (those will still release/refund via `IERC20.safeTransfer`), but it instantly blocks new settlements for that token. More critically, adding a malicious or non-ERC-3009-compliant token instantly enables it for settlements, and the only guard is a `code.length > 0` check which does not verify ERC-3009 compliance. An event is emitted, but users and sellers have zero time to react before the change takes effect.
**Proof of Concept**:
1. Owner calls `setSupportedToken(maliciousToken, true)` where `maliciousToken` is a contract that implements `receiveWithAuthorization` but has unexpected side effects (e.g., re-entrancy via hooks, fee-on-transfer behavior).
2. The change is effective in the same block.
3. Sellers who auto-accept any supported token may settle payments in this token without knowing it was just added.
**Recommendation**: Introduce a timelock (e.g., 48 hours) for adding new supported tokens. At minimum, separate the announcement from the activation:
```solidity
mapping(address => uint256) public pendingTokenActivation;
uint256 public constant TOKEN_TIMELOCK = 48 hours;

function proposeToken(address token) external onlyOwner {
    pendingTokenActivation[token] = block.timestamp + TOKEN_TIMELOCK;
}

function activateToken(address token) external onlyOwner {
    require(pendingTokenActivation[token] != 0 && block.timestamp >= pendingTokenActivation[token], "X402: timelock");
    supportedTokens[token] = true;
    delete pendingTokenActivation[token];
}
```

---

## [AC-02] Compromised owner can disable all token support and grief the protocol
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `setSupportedToken()` (line 420), `deactivateSeller()` (line 216)
**Description**: If the single owner key is compromised, the attacker can: (a) remove all supported tokens, blocking all new settlements; (b) deactivate all sellers via `deactivateSeller(wallet)` which the owner is authorized to call for any seller (line 218). While the attacker cannot drain escrowed funds directly (there is no `rescueTokens` or admin withdrawal function -- which is good), they can permanently DoS the protocol. The contract uses `Ownable2Step` which mitigates accidental transfer, but does not mitigate key compromise. The contract comments mention "use a multisig as owner for production" but this is not enforced on-chain.
**Proof of Concept**:
1. Attacker compromises the owner private key.
2. Attacker calls `setSupportedToken(token, false)` for every supported token.
3. Attacker calls `deactivateSeller(wallet)` for every active seller.
4. No new payments can be settled. Existing escrowed funds are still releasable/refundable by their respective parties, but the protocol is effectively bricked for new business.
**Recommendation**: Deploy with a multisig (e.g., Gnosis Safe) as owner. Consider adding a timelock contract (e.g., OpenZeppelin `TimelockController`) between the multisig and the verifier for critical admin operations.

---

## [AC-03] Seller can redirect refunds to arbitrary address via refundTo()
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `refundTo()` (line 389)
**Description**: The `refundTo()` function allows the seller (payment recipient) to refund escrowed funds to any arbitrary address, not just the original payer. While the function is documented as a safety valve for blocklisted payers, this gives the seller unilateral power to redirect a refund. A malicious seller could settle a payment (pulling funds from the payer into escrow) and then immediately call `refundTo()` with their own address or an accomplice's address, effectively stealing the payer's funds under the guise of a "refund." The payer has no on-chain recourse once the funds are sent to the wrong address.
**Proof of Concept**:
1. Seller calls `settle()` with a valid ERC-3009 authorization from the payer, pulling 1000 USDC into escrow.
2. Seller immediately calls `refundTo(invoiceId, sellerControlledAddress)`.
3. The 1000 USDC is sent to `sellerControlledAddress` instead of back to the payer.
4. The payment is marked as `refunded = true`, so the payer cannot recover the funds.
**Recommendation**: Restrict `refundTo()` to require the payer's consent (e.g., an off-chain signature from the payer authorizing the alternate refund address), or limit the alternate address to be set by the payer, not the seller. As a simpler alternative, remove `refundTo()` entirely and only allow refunds to the original payer via `refund()`.

---

## [AC-04] Owner can deactivate any seller without notice or timelock
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `deactivateSeller()` (line 216)
**Description**: The contract owner can deactivate any seller instantly by calling `deactivateSeller(wallet)`. This blocks the seller from settling new payments immediately. While existing escrowed payments are unaffected (release and refund still work), the seller has no advance warning or time to complete pending business. This is a centralization risk where the owner has unilateral power to remove sellers from the marketplace without a grace period.
**Proof of Concept**:
1. Owner calls `deactivateSeller(sellerAddress)`.
2. The seller is immediately removed from the active list.
3. Any in-flight ERC-3009 authorizations from buyers targeting this seller can no longer be settled (the `sellers[recipient].active` check in `settle()` will fail).
**Recommendation**: Add a deactivation delay (e.g., 24-48 hours) for owner-initiated deactivations, allowing the seller to complete pending settlements. Self-deactivation by the seller can remain instant.

---

## [AC-05] Escrow duration change takes effect immediately without timelock
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `updateSeller()` (line 200)
**Description**: A seller can change their `escrowDuration` via `updateSeller()` at any time. The new duration applies to all future settlements immediately. A seller could reduce their escrow duration to `MIN_ESCROW_DURATION` (which is 0), and then settle a payment that is instantly releasable with no refund window. While this is the seller's own configuration and buyers implicitly trust the seller, there is no on-chain mechanism for buyers to verify or enforce a minimum escrow period before signing their ERC-3009 authorization. The authorization is signed off-chain, and the buyer has no control over when it is executed or what escrow parameters apply at settlement time.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 86400` (24 hours).
2. Buyer sees the seller has a 24-hour escrow and signs an ERC-3009 authorization.
3. Seller calls `updateSeller()` with `escrowDuration = 1` (1 second).
4. Seller calls `settle()`. The `releaseAt` is set to `block.timestamp + 1`.
5. One second later, seller (or anyone) calls `release()`. Funds are released instantly with no meaningful refund window.
**Recommendation**: Either enforce a minimum escrow duration greater than zero for buyer protection, or include the expected escrow duration in the `settle()` parameters so it can be validated against the buyer's expectations:
```solidity
// In settle(), add a minEscrow parameter
require(sellers[recipient].escrowDuration >= minEscrowDuration, "X402: escrow too short");
```

---

## [AC-06] No event emitted on escrow duration changes
**Severity**: Info
**Category**: evm-audit-access-control
**Location**: `updateSeller()` (line 200), `reactivateSeller()` (line 178)
**Description**: When a seller changes their `escrowDuration` via `updateSeller()` or `reactivateSeller()`, the `SellerUpdated` event does not include the new escrow duration. Off-chain monitoring systems cannot detect escrow parameter changes without parsing storage diffs. This is related to the checklist item on instant parameter changes without event emission.
**Proof of Concept**: A seller calls `updateSeller("url", "desc", 1)`. The `SellerUpdated` event is emitted but only contains `wallet` and `apiBaseUrl`, not the changed `escrowDuration`.
**Recommendation**: Add the escrow duration to the `SellerUpdated` and `SellerRegistered` events:
```solidity
event SellerRegistered(address indexed wallet, string apiBaseUrl, uint256 escrowDuration);
event SellerUpdated(address indexed wallet, string apiBaseUrl, uint256 escrowDuration);
```
