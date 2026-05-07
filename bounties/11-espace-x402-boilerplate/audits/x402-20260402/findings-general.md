# X402PaymentVerifier - General EVM Audit Findings

**Contract**: `X402PaymentVerifier.sol`
**Pragma**: `^0.8.24`
**Date**: 2026-04-02
**Checklist**: evm-audit-general

---

## [GEN-1] Caller-supplied `invoiceId` enables front-running and collision attacks
**Severity**: High
**Category**: evm-audit-general
**Location**: `settle()`
**Description**: The `invoiceId` is supplied by the caller and used as the sole key in the `payments` mapping. The only guard is `require(payments[invoiceId].paidAt == 0)`. A malicious actor (another seller, or an MEV bot) can observe a pending `settle()` transaction in the mempool and front-run it by submitting their own `settle()` with the same `invoiceId` but different payment parameters. This permanently blocks the legitimate payment from being recorded under that ID. Because `invoiceId` is a global namespace shared across all sellers, any seller can grief any other seller's settlement.
**Proof of Concept**:
1. Seller A submits `settle(invoiceId=0xABC, ...)` to the mempool.
2. Seller B (or MEV bot) front-runs with `settle(invoiceId=0xABC, ...)` using their own valid ERC-3009 authorization and higher gas.
3. Seller B's transaction lands first; Seller A's reverts with "X402: already paid".
4. Seller A must coordinate a new `invoiceId` with the buyer.
**Recommendation**: Derive `invoiceId` deterministically from payment parameters: `bytes32 invoiceId = keccak256(abi.encode(from, recipient, token, nonce))`. Alternatively, namespace the key by recipient: `payments[keccak256(abi.encode(invoiceId, recipient))]`.

---

## [GEN-2] `refundTo()` allows seller to redirect escrowed funds to arbitrary address
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `refundTo()`, `_refundTo()`
**Description**: The `refundTo()` function allows the seller (`p.recipient`) to send escrowed funds to any address except `address(0)` and `p.recipient`. The check `require(refundRecipient != payments[invoiceId].recipient)` only prevents a direct self-refund, but the seller can use any other address they control. This means a malicious seller can "refund" buyer funds to their own alternate wallet during the escrow period, marking the payment as `refunded = true` and emitting a `Refunded` event -- effectively stealing the buyer's funds while appearing to have issued a legitimate refund.
**Proof of Concept**:
1. Buyer authorizes payment. Seller calls `settle()`.
2. Within escrow, seller calls `refundTo(invoiceId, sellerAlternateWallet)`.
3. Payment is marked refunded. Buyer's funds go to seller's other wallet.
4. Events show a "refund" occurred, obscuring the theft.
**Recommendation**: Restrict `refundTo` so the refund recipient must be the original payer, or require the payer's signature for alternative refund addresses:
```solidity
require(refundRecipient == p.payer, "X402: can only refund to payer");
```
If alternative recipients are needed (e.g., blocklisted payer), require a separate payer-signed authorization.

---

## [GEN-3] Seller can set escrow duration to zero or near-zero, defeating the refund window
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `_validateEscrowDuration()`, `settle()`
**Description**: `MIN_ESCROW_DURATION` is defined as 0, and `_validateEscrowDuration()` only checks the upper bound. A seller can register with `escrowDuration = 0` (or 1 second), causing `releaseAt = block.timestamp + 0`. The `release()` function's `require(block.timestamp >= p.releaseAt)` passes immediately in the same block. Meanwhile, `refund()` requires `block.timestamp < p.releaseAt`, which is impossible when escrow is 0. This completely eliminates the buyer's dispute window, rendering the escrow mechanism useless for that seller.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 0`.
2. Seller calls `settle()` -- `releaseAt = block.timestamp`.
3. Anyone calls `release()` in the same block -- succeeds immediately.
4. Buyer cannot call `refund()` as `block.timestamp < p.releaseAt` is never true.
**Recommendation**: Enforce a meaningful minimum escrow:
```solidity
uint256 public constant MIN_ESCROW_DURATION = 1 hours;
function _validateEscrowDuration(uint256 duration) internal pure returns (uint256) {
    require(duration >= MIN_ESCROW_DURATION, "X402: escrow too short");
    require(duration <= MAX_ESCROW_DURATION, "X402: escrow too long");
    return duration;
}
```

---

## [GEN-4] Force-feeding ETH inflates `withdrawFees()` beyond actual registration fees collected
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `withdrawFees()`
**Description**: `withdrawFees()` sends the entire `address(this).balance` to the owner. ETH can be force-sent to the contract via `selfdestruct` (deprecated but still functional), coinbase rewards, or pre-funded addresses. This inflates the balance beyond what was actually collected through registration fees. While the owner is trusted, this breaks the accounting invariant that withdrawn fees equal collected fees. On Conflux eSpace, equivalent force-send mechanisms may also exist.
**Proof of Concept**:
1. Attacker deploys a contract funded with 10 ETH.
2. Attacker calls `selfdestruct(X402PaymentVerifierAddress)`.
3. Contract balance is now 10 ETH + registration fees.
4. Owner calls `withdrawFees()` and receives inflated amount.
**Recommendation**: Track collected fees explicitly:
```solidity
uint256 public collectedFees;
// In registerSeller/reactivateSeller:
collectedFees += registrationFee;
// In withdrawFees:
uint256 amount = collectedFees;
collectedFees = 0;
(bool sent, ) = owner().call{value: amount}("");
```

---

## [GEN-5] Compromised seller can reactivate after owner-initiated deactivation
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `deactivateSeller()`, `reactivateSeller()`
**Description**: `deactivateSeller()` can be called by the owner to forcefully deactivate a malicious or compromised seller. However, that same seller address can immediately call `reactivateSeller()` to become active again, as reactivation only checks `sellers[msg.sender].registeredAt > 0` and `!sellers[msg.sender].active` -- there is no blocklist mechanism. This makes owner-initiated deactivation ineffective as a security measure.
**Proof of Concept**:
1. Owner detects a compromised seller and calls `deactivateSeller(sellerAddr)`.
2. Compromised seller immediately calls `reactivateSeller("url", "desc", escrow)`.
3. Seller is active again; owner's action was futile.
**Recommendation**: Add a blocklist that prevents reactivation:
```solidity
mapping(address => bool) public blockedSellers;
function blockSeller(address wallet) external onlyOwner {
    blockedSellers[wallet] = true;
    if (sellers[wallet].active) { /* deactivate */ }
}
// In reactivateSeller:
require(!blockedSellers[msg.sender], "X402: seller blocked");
```

---

## [GEN-6] `release()` has no access control -- anyone can trigger fund release after escrow
**Severity**: Low
**Category**: evm-audit-general
**Location**: `release()`
**Description**: The `release()` function has no caller restriction. Anyone can call it after the escrow period ends, forcing the transfer of escrowed funds to `p.recipient`. While funds go to the correct recipient, this removes the recipient's ability to delay claiming (e.g., for tax timing, coordination with disputes, or operational reasons). In contrast, `releaseTo()` correctly restricts to `msg.sender == p.recipient`.
**Proof of Concept**: After escrow ends, a bot or third party calls `release(invoiceId)`. Funds are sent to the recipient regardless of the recipient's preference.
**Recommendation**: Add `require(msg.sender == p.recipient, "X402: only recipient can release")` for consistency with `releaseTo()`.

---

## [GEN-7] No mechanism to recover funds when recipient cannot receive tokens after escrow
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `release()`, `_refundTo()`
**Description**: After the escrow period ends, `refund()` is permanently blocked (`require(block.timestamp < p.releaseAt)`). If `release()` reverts because the recipient address cannot receive the token (e.g., the recipient is a contract without ERC-20 handling, or the recipient is blocklisted by the token contract), the funds are permanently stuck. There is no fallback mechanism -- no owner-mediated emergency withdrawal, no payer reclaim after a timeout, nothing.
**Proof of Concept**:
1. Payment is settled. Escrow passes.
2. Recipient address is blocklisted by the USDC contract (a real scenario with Centre's blocklist).
3. `release()` calls `safeTransfer` to recipient -- reverts due to blocklist.
4. `refund()` reverts because escrow has ended.
5. Funds are permanently locked in the contract.
**Recommendation**: Add an emergency function with a long cooldown (e.g., 90 days after `releaseAt`) that allows the owner or payer to recover funds:
```solidity
function emergencyWithdraw(bytes32 invoiceId) external {
    Payment storage p = payments[invoiceId];
    require(p.paidAt > 0 && !p.released && !p.refunded);
    require(block.timestamp > p.releaseAt + 90 days);
    // return to payer
}
```

---

## [GEN-8] `validAfter` is not validated against `block.timestamp` in `settle()`
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `settle()`
**Description**: The `settle()` function validates `block.timestamp < validBefore` but does not check `block.timestamp >= validAfter`. While the underlying ERC-3009 token contract will enforce this, the missing check wastes gas on transactions that will inevitably revert at the token level, and produces an opaque error message from the token contract rather than a clear contract-level revert reason.
**Proof of Concept**:
1. Authorization has `validAfter = block.timestamp + 1 hour`.
2. Seller calls `settle()` immediately.
3. All X402 contract-level checks pass (gas consumed for all requires and storage reads).
4. `receiveWithAuthorization` reverts with a token-level error.
**Recommendation**: Add `require(block.timestamp >= validAfter, "X402: authorization not yet valid")`.

---

## [GEN-9] Registration fee overpayment is silently absorbed
**Severity**: Low
**Category**: evm-audit-general
**Location**: `registerSeller()`, `reactivateSeller()`
**Description**: Both functions use `require(msg.value >= registrationFee)` but do not refund excess ETH. If a user accidentally sends more than required, the excess remains in the contract and is swept by the owner via `withdrawFees()`. The user has no recourse to recover the overpayment.
**Proof of Concept**:
1. Registration fee is 0.01 ETH.
2. User sends 1 ETH by mistake.
3. 0.99 ETH excess is absorbed by the contract.
**Recommendation**: Use exact matching or refund the difference:
```solidity
require(msg.value == registrationFee, "X402: exact fee required");
```

---

## [GEN-10] `updateSeller` and `reactivateSeller` cannot set escrow duration to zero
**Severity**: Low
**Category**: evm-audit-general
**Location**: `updateSeller()`, `reactivateSeller()`
**Description**: Both functions use `if (escrowDuration > 0)` to conditionally update the escrow duration. This means passing `escrowDuration = 0` silently keeps the old value. Since `_validateEscrowDuration` accepts 0 as valid (per `MIN_ESCROW_DURATION = 0`), a seller who registered with a nonzero escrow can never change it to zero. The semantics of "0 means don't change" vs "0 is a valid value" are conflated.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 1 days`.
2. Seller calls `updateSeller("url", "desc", 0)`.
3. Escrow duration remains 1 day, with no indication the update was ignored.
**Recommendation**: Use a sentinel value (e.g., `type(uint256).max`) for "do not change", or add a separate boolean parameter.

---

## [GEN-11] Double computation of nonce key hash in `settle()`
**Severity**: Info
**Category**: evm-audit-general
**Location**: `settle()`
**Description**: `keccak256(abi.encode(from, nonce))` is computed twice -- once inside the `require(!usedNonces[...])` check and again when assigning `nonceKey`. This wastes ~100 gas.
**Proof of Concept**: N/A -- gas inefficiency only.
**Recommendation**: Compute the key once before the require:
```solidity
bytes32 nonceKey = keccak256(abi.encode(from, nonce));
require(!usedNonces[nonceKey], "X402: nonce already used");
usedNonces[nonceKey] = true;
```

---

## [GEN-12] PUSH0 opcode may be incompatible with Conflux eSpace
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `pragma solidity ^0.8.24`
**Description**: Solidity 0.8.20+ emits the `PUSH0` opcode (Shanghai EVM upgrade). If Conflux eSpace does not support Shanghai-level opcodes, deployment or execution will fail with an invalid opcode error. The `^0.8.24` pragma permits compilers that will emit `PUSH0` by default.
**Proof of Concept**: Compile with solc 0.8.24 default settings and deploy on a chain without Shanghai support. Transaction reverts.
**Recommendation**: Verify Conflux eSpace Shanghai support. If unsupported, set `evmVersion: "paris"` in compiler settings or pin to solc 0.8.19.

---

## [GEN-13] `verifyPayment` does not report `released` status
**Severity**: Low
**Category**: evm-audit-general
**Location**: `verifyPayment()`
**Description**: `verifyPayment()` checks `paidAt` and `refunded` but does not return whether the payment has been `released`. Off-chain consumers calling this function cannot distinguish between a payment still in escrow and one that has been fully settled. This could lead to incorrect business logic (e.g., granting API access for a payment whose funds have already been released to the seller vs. one still in dispute-eligible escrow).
**Proof of Concept**: Call `verifyPayment` on a released payment -- returns `(true, payer)` with no indication that escrow has resolved.
**Recommendation**: Add `released` to the return values:
```solidity
function verifyPayment(...) external view returns (bool valid, address payer, bool released) {
    // ...
    return (true, p.payer, p.released);
}
```

---

## [GEN-14] No `from` address validation in `settle()` -- `address(0)` and `address(this)` not excluded
**Severity**: Low
**Category**: evm-audit-general
**Location**: `settle()`
**Description**: `settle()` validates `recipient != address(0)` and `from != recipient`, but does not check `from != address(0)` or `from != address(this)`. While ERC-3009 signature verification would reject `address(0)` as a signer in practice, there is no explicit guard. If `from == address(this)`, a valid authorization (impossible to forge in practice but worth defending against) could allow draining the contract's own escrowed token balance.
**Proof of Concept**: Theoretical only -- requires forging a signature from `address(this)` or `address(0)`.
**Recommendation**: Add explicit validation:
```solidity
require(from != address(0), "X402: zero payer");
require(from != address(this), "X402: contract cannot be payer");
```

---

## [GEN-15] Escrow boundary allows release but not refund at exact `releaseAt` timestamp
**Severity**: Low
**Category**: evm-audit-general
**Location**: `release()`, `_refundTo()`
**Description**: `release()` uses `>=` (`block.timestamp >= p.releaseAt`) while `_refundTo()` uses `<` (`block.timestamp < p.releaseAt`). At exactly `block.timestamp == p.releaseAt`, release succeeds but refund fails. If both transactions are submitted in the same block at the boundary, the seller loses the ability to refund. This is logically consistent (no overlap) but may surprise sellers who expect the escrow deadline to be inclusive for refunds.
**Proof of Concept**: Seller submits `refund(invoiceId)` in a block where `block.timestamp == p.releaseAt`. Transaction reverts.
**Recommendation**: Document the boundary behavior in NatSpec. Optionally adjust to make the refund deadline inclusive and release exclusive by one second.

---

## [GEN-16] Duplicate token addresses in constructor silently accepted
**Severity**: Info
**Category**: evm-audit-general
**Location**: `constructor()`
**Description**: The constructor loop sets `supportedTokens[_tokens[i]] = true` without checking for duplicates. While idempotent and not exploitable, it may mask deployment misconfigurations.
**Proof of Concept**: Deploy with `[tokenA, tokenA]` -- no revert, two `TokenSupported` events for the same address.
**Recommendation**: Add `require(!supportedTokens[_tokens[i]], "X402: duplicate token")`.

---

## [GEN-17] `setRegistrationFee` has no upper bound
**Severity**: Low
**Category**: evm-audit-general
**Location**: `setRegistrationFee()`
**Description**: The owner can set `registrationFee` to any `uint256` value, including unreasonably high amounts that effectively prevent new seller registrations. While this requires a malicious or compromised owner, a maximum cap provides defense in depth.
**Proof of Concept**: Owner calls `setRegistrationFee(type(uint256).max)`. No new sellers can register.
**Recommendation**: Add `require(fee <= MAX_REGISTRATION_FEE)` with a reasonable constant.

---

## [GEN-18] `reactivateSeller` emits `SellerRegistered` instead of a distinct event
**Severity**: Info
**Category**: evm-audit-general
**Location**: `reactivateSeller()`
**Description**: `reactivateSeller()` emits `SellerRegistered`, the same event as first-time registration. Off-chain indexers cannot distinguish reactivation from initial registration, potentially causing incorrect seller count tracking or duplicate registration alerts.
**Proof of Concept**: Same seller address emits `SellerRegistered` twice -- once on registration, once on reactivation.
**Recommendation**: Emit a distinct `SellerReactivated` event.

---

## [GEN-19] No token rescue function for accidentally sent ERC-20 tokens
**Severity**: Low
**Category**: evm-audit-general
**Location**: Contract-wide
**Description**: If ERC-20 tokens are sent directly to the contract (not through `settle()`), they are permanently locked. The contract has no `rescueTokens()` function. The `release()` and `refund()` paths only operate on recorded payment amounts, so any excess token balance is stranded forever.
**Proof of Concept**: User calls `token.transfer(contractAddress, amount)` directly. Tokens are permanently stuck.
**Recommendation**: Add an owner-only rescue function that can withdraw tokens not accounted for in active escrows. This requires tracking total escrowed amounts per token.

---

## [GEN-20] `Payment` struct stores full `endpoint` string on-chain -- expensive storage
**Severity**: Info
**Category**: evm-audit-general
**Location**: `Payment` struct
**Description**: The `endpoint` field is a dynamic `string` stored in the `Payment` struct. String storage is expensive. Since `endpoint` is only used in `verifyPayment()` for a hash comparison, and the full string is already emitted in the `PaymentReceived` event for off-chain indexing, storing only the hash would save significant gas.
**Proof of Concept**: N/A -- gas optimization.
**Recommendation**: Store `bytes32 endpointHash = keccak256(bytes(endpoint))` instead of the full string.

---

## [GEN-21] `withdrawFees()` could be permanently bricked if owner is a non-receiving contract
**Severity**: Low
**Category**: evm-audit-general
**Location**: `withdrawFees()`
**Description**: `owner().call{value: balance}("")` will fail if the owner address is a contract that reverts on ETH receipt. While `Ownable2Step` requires the new owner to actively accept (mitigating accidental transfers), the owner contract could later upgrade its logic to reject ETH, permanently bricking fee withdrawal.
**Proof of Concept**:
1. Ownership is transferred to a multisig proxy.
2. Proxy upgrades to a version whose `receive()` reverts.
3. `withdrawFees()` permanently reverts.
**Recommendation**: Allow the owner to specify a separate withdrawal address, or implement a pull-based withdrawal pattern.

---

## [GEN-22] `block.chainid` in event is not validated -- potential cross-chain replay
**Severity**: Low
**Category**: evm-audit-general
**Location**: `settle()`
**Description**: The `PaymentReceived` event includes `block.chainid` for informational purposes, but the contract does not validate or store the chain ID. In a chain fork scenario, the same contract at the same address on both chains could process the same ERC-3009 authorization independently, as the contract's `usedNonces` mapping is separate state on each fork. Whether this is exploitable depends on whether the ERC-3009 token's domain separator includes the chain ID.
**Proof of Concept**: After a chain fork, seller calls `settle()` with the same authorization on both chains, double-charging the payer.
**Recommendation**: Store `immutable uint256 DEPLOYMENT_CHAIN_ID = block.chainid` in the constructor and validate in `settle()`:
```solidity
require(block.chainid == DEPLOYMENT_CHAIN_ID, "X402: wrong chain");
```

---

## [GEN-23] Owner can remove token support while escrows are active -- no impact but undocumented
**Severity**: Info
**Category**: evm-audit-general
**Location**: `removeToken()`, `release()`, `refund()`
**Description**: `removeToken()` can remove a token while payments in that token are still escrowed. Existing `release()` and `refund()` calls do not check `supportedTokens`, so they continue to work correctly. However, this behavior is not documented and could confuse operators who expect token removal to affect in-flight payments.
**Proof of Concept**: N/A -- existing escrows are unaffected.
**Recommendation**: Add NatSpec documenting that token removal only affects new settlements.

---

## [GEN-24] `received > 0` check in `settle()` does not verify `received == value` -- fee-on-transfer discrepancy
**Severity**: Low
**Category**: evm-audit-general
**Location**: `settle()`
**Description**: The balance-difference pattern correctly captures the actual amount received, but `require(received > 0)` does not verify that `received == value`. For fee-on-transfer tokens, `received < value`, meaning the payment is recorded for less than the buyer authorized. The buyer authorized `value` but the payment records `received`. Off-chain systems using the authorized `value` for reconciliation will see a mismatch with the on-chain `amount`.
**Proof of Concept**: Token has 1% fee. Buyer authorizes 100. Contract receives 99. Payment records 99. Off-chain system expected 100.
**Recommendation**: Either add `require(received == value, "X402: amount mismatch")` to reject fee-on-transfer tokens, or emit both `value` and `received` in the event for reconciliation.
