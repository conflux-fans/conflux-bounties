# X402PaymentVerifier - General EVM Audit Findings

**Contract**: `X402PaymentVerifier.sol`
**Pragma**: `^0.8.24`
**Date**: 2026-04-02
**Checklist**: evm-audit-general

---

## [G-1] `abi.encodePacked` with two dynamic-width values enables nonce-key collisions
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `settle()` lines 282, 293
**Description**: The nonce-tracking key is computed as `keccak256(abi.encodePacked(from, nonce))`. Both `from` (address, 20 bytes) and `nonce` (bytes32, 32 bytes) are fixed-width types, so in this specific case there is no collision between different type encodings. However, `abi.encodePacked` with an `address` does not left-pad to 32 bytes the way `abi.encode` does. While address + bytes32 packing is unambiguous, using `abi.encode` is the idiomatic safer pattern and avoids any future refactoring risk if additional dynamic parameters are added to the hash.

After deeper analysis: `address` is 20 bytes fixed and `bytes32` is 32 bytes fixed. The packed encoding is deterministic and collision-free for this specific pair. Downgrading to Info.

**Severity**: Info
**Category**: evm-audit-general
**Location**: `settle()` lines 282, 293
**Description**: `keccak256(abi.encodePacked(from, nonce))` uses `abi.encodePacked` for the nonce key. While safe for this specific (address, bytes32) pair since both are fixed-width, using `abi.encode` is the recommended practice to prevent collisions if the schema is ever extended.
**Proof of Concept**: No exploit currently possible. Risk arises only if future refactoring adds dynamic types to the hash preimage.
**Recommendation**: Replace with `abi.encode` for defense in depth:
```solidity
bytes32 nonceKey = keccak256(abi.encode(from, nonce));
```

---

## [G-2] PUSH0 opcode incompatibility with Conflux eSpace and other non-mainnet chains
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `pragma solidity ^0.8.24` (line 2)
**Description**: Solidity >=0.8.20 emits the `PUSH0` opcode by default. This contract targets Conflux eSpace, which may not support `PUSH0` depending on the EVM version implemented. If the target chain's EVM does not include `PUSH0` (introduced in the Shanghai upgrade), deployment or execution will fail. The `^0.8.24` pragma allows any compiler from 0.8.24 onward, all of which emit `PUSH0`.
**Proof of Concept**: Compile the contract with solc >=0.8.20 and attempt deployment on a chain that has not adopted the Shanghai upgrade. The deployment transaction will revert due to the invalid opcode.
**Recommendation**: Verify that Conflux eSpace supports the Shanghai upgrade and `PUSH0`. If not, either pin the compiler to 0.8.19 or set the EVM target version to `paris` in the compiler settings:
```
solidity: {
  compilers: [{ version: "0.8.24", settings: { evmVersion: "paris" } }]
}
```

---

## [G-3] Seller can set escrow duration to zero, enabling immediate release and defeating refund protection
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `_validateEscrowDuration()` line 471-476, `settle()` line 319
**Description**: `MIN_ESCROW_DURATION` is 0 and `_validateEscrowDuration` accepts any value in `[0, MAX_ESCROW_DURATION]`. When `duration == 0`, it returns `DEFAULT_ESCROW_DURATION` (24h). However, a seller can pass `duration = 1` (1 second) during registration. In `settle()`, `releaseAt` is set to `block.timestamp + 1`, meaning anyone can call `release()` in the very next block (or even the same block if timestamp allows `>=`). This effectively bypasses the escrow refund window, defeating the stated purpose of escrow ("held in escrow for a grace period during which the seller can issue refunds"). A malicious seller could settle and immediately release, making refunds impossible for buyers.
**Proof of Concept**:
1. Seller calls `registerSeller("url", "desc", 1)` -- escrow duration = 1 second.
2. Seller calls `settle(...)` -- `releaseAt = block.timestamp + 1`.
3. In the same transaction (or next block), seller calls `release(invoiceId)` -- `block.timestamp >= releaseAt` passes.
4. Buyer has no time to request a refund.
**Recommendation**: Set `MIN_ESCROW_DURATION` to a meaningful minimum (e.g., 1 hour) and enforce it:
```solidity
uint256 public constant MIN_ESCROW_DURATION = 1 hours;
```

---

## [G-4] Duplicate token addresses in constructor are silently accepted
**Severity**: Info
**Category**: evm-audit-general
**Location**: `constructor()` lines 132-139
**Description**: The constructor iterates over `_tokens` and sets `supportedTokens[_tokens[i]] = true` without checking for duplicates. While this does not cause a security issue (setting a bool to true twice is idempotent), it may indicate a deployment misconfiguration.
**Proof of Concept**: Deploy with `[tokenA, tokenA]` -- no revert, no warning.
**Recommendation**: Add a duplicate check:
```solidity
require(!supportedTokens[_tokens[i]], "X402: duplicate token");
```

---

## [G-5] Off-by-one: escrow period boundary allows release and refund to race at `releaseAt`
**Severity**: Low
**Category**: evm-audit-general
**Location**: `release()` line 339, `_refundTo()` line 399
**Description**: `release()` requires `block.timestamp >= p.releaseAt` while `_refundTo()` requires `block.timestamp < p.releaseAt`. At exactly `block.timestamp == p.releaseAt`, the release path is open but the refund path is closed. This is logically consistent (no overlap), but means the last possible refund moment is the block before `releaseAt`, which may be unexpected for sellers who think they have until the escrow deadline to refund. More importantly, if both `release()` and `refund()` are submitted in the same block where `block.timestamp == p.releaseAt`, only `release()` can succeed. This is likely intentional but worth documenting.
**Proof of Concept**: Seller submits `refund(invoiceId)` in a block where `block.timestamp == p.releaseAt`. Transaction reverts with "X402: escrow period ended".
**Recommendation**: Document this boundary behavior clearly in NatSpec. If the intention is to allow refund up to and including the deadline, change the refund check to `<=`:
```solidity
require(block.timestamp <= p.releaseAt, "X402: escrow period ended");
```
And change release to `>`:
```solidity
require(block.timestamp > p.releaseAt, "X402: escrow period active");
```

---

## [G-6] `refundTo` allows seller to redirect escrowed funds to arbitrary address
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `refundTo()` lines 389-391, `_refundTo()` line 394
**Description**: The `refundTo()` function allows the seller (payment recipient) to send escrowed funds to any address, not just the original payer. While the stated use case is handling blocklisted payer addresses, this also means a malicious seller can "refund" funds to their own wallet or any other address they control during the escrow period. Since only the seller can initiate refunds, and they could also just wait for release, this is primarily a trust-model concern -- but it means the `refunded` flag and `Refunded` event may be misleading, as funds labeled "refunded" could go to the seller rather than the buyer.
**Proof of Concept**:
1. Seller settles a payment from buyer.
2. Within escrow period, seller calls `refundTo(invoiceId, sellerOwnAddress)`.
3. Payment is marked `refunded = true`, funds go to seller, buyer receives nothing.
4. `Refunded` event shows `refundRecipient = sellerAddress`, but off-chain systems may not distinguish this from a legitimate refund.
**Recommendation**: Consider restricting `refundTo` so the refund recipient cannot be the seller/recipient of the payment, or require buyer co-signature for alternative refund addresses:
```solidity
require(refundRecipient != p.recipient, "X402: cannot refund to seller");
```

---

## [G-7] No mechanism to recover tokens sent directly to the contract
**Severity**: Low
**Category**: evm-audit-general
**Location**: Contract-wide
**Description**: If ERC-20 tokens are sent directly to the contract (not through `settle()`), they become permanently locked. The contract has no `rescueTokens()` or similar admin function to recover accidentally sent funds. The `release()` and `refund()` functions only operate on recorded payment amounts, so excess balance is stranded.
**Proof of Concept**: User accidentally calls `token.transfer(contractAddress, amount)` directly. Tokens are stuck with no recovery path.
**Recommendation**: Add an owner-only rescue function that can only withdraw tokens not accounted for in active escrows, or a simpler emergency sweep with a timelock.

---

## [G-8] `sellerList` can grow unboundedly, making `getActiveSellers` expensive
**Severity**: Low
**Category**: evm-audit-general
**Location**: `registerSeller()` line 169, `reactivateSeller()` line 190, `getActiveSellers()` lines 449-462
**Description**: While `getActiveSellers` is paginated (view function, no gas cost for external reads), the `sellerList` array grows with each registration and reactivation. The swap-and-pop in `deactivateSeller` keeps it bounded to active sellers, but repeated activate/deactivate cycles keep adding and removing entries. This is not a direct vulnerability due to pagination, but on-chain iteration over `sellerList` from other contracts could be expensive.
**Proof of Concept**: N/A -- mitigated by pagination in the view function.
**Recommendation**: Informational only. The current design with pagination is adequate.

---

## [G-9] Seller re-registration is permanently blocked after first registration
**Severity**: Low
**Category**: evm-audit-general
**Location**: `registerSeller()` line 156
**Description**: The check `sellers[msg.sender].registeredAt == 0` permanently prevents an address from calling `registerSeller` again, even after deactivation. Deactivated sellers must use `reactivateSeller()` instead. However, `reactivateSeller` does not allow changing the `registeredAt` timestamp, and the separation between "register" and "reactivate" could confuse integrators. If a seller's address is compromised and deactivated by the owner, the compromised address can call `reactivateSeller()` to reactivate itself (since only `active` status is checked, not authorization beyond `msg.sender`).
**Proof of Concept**:
1. Seller registers with address A.
2. Owner deactivates address A due to compromise.
3. Compromised address A calls `reactivateSeller(...)` and becomes active again.
**Recommendation**: Add an owner-controlled blocklist, or require owner approval for reactivation after owner-initiated deactivation:
```solidity
mapping(address => bool) public blockedSellers;
```
In `reactivateSeller`:
```solidity
require(!blockedSellers[msg.sender], "X402: seller blocked");
```

---

## [G-10] Double computation of nonce key hash in `settle()`
**Severity**: Info
**Category**: evm-audit-general
**Location**: `settle()` lines 282, 293
**Description**: `keccak256(abi.encodePacked(from, nonce))` is computed twice -- once for the `require` check and once to set the mapping. This wastes gas.
**Proof of Concept**: N/A -- gas inefficiency only.
**Recommendation**: Cache the hash:
```solidity
bytes32 nonceKey = keccak256(abi.encodePacked(from, nonce));
require(!usedNonces[nonceKey], "X402: nonce already used");
usedNonces[nonceKey] = true;
```

---

## [G-11] `verifyPayment` does not check `released` status
**Severity**: Low
**Category**: evm-audit-general
**Location**: `verifyPayment()` lines 358-371
**Description**: The `verifyPayment` view function checks `paidAt` and `refunded` but does not return whether the payment has been `released`. Off-chain consumers may need to know whether funds are still in escrow or have been transferred to the seller to make correct decisions. A payment that has been released is "completed," while one still in escrow is "pending." This distinction could matter for dispute resolution or accounting.
**Proof of Concept**: Call `verifyPayment` on a released payment -- returns `(true, payer)` with no indication that escrow has already been resolved.
**Recommendation**: Either add `released` to the return values or document that `verifyPayment` intentionally does not distinguish escrow states:
```solidity
function verifyPayment(...)
    external view
    returns (bool valid, address payer, bool released)
{
    // ...
    return (true, p.payer, p.released);
}
```

---

## [G-12] `reactivateSeller` emits `SellerRegistered` instead of a reactivation-specific event
**Severity**: Info
**Category**: evm-audit-general
**Location**: `reactivateSeller()` line 193
**Description**: `reactivateSeller` emits `SellerRegistered` which is the same event as initial registration. Off-chain indexers cannot distinguish between a new registration and a reactivation, which could cause incorrect accounting of seller counts or history.
**Proof of Concept**: Monitor `SellerRegistered` events -- the same seller address appears multiple times with no way to differentiate registration from reactivation.
**Recommendation**: Emit a dedicated `SellerReactivated` event or add a boolean parameter to `SellerRegistered`.

---

## [G-13] No validation that `from` address is not `address(0)` or `address(this)` in `settle()`
**Severity**: Low
**Category**: evm-audit-general
**Location**: `settle()` lines 263-276
**Description**: The `settle()` function validates `recipient != address(0)` and `from != recipient`, but does not check that `from != address(0)` or `from != address(this)`. While the ERC-3009 `receiveWithAuthorization` would likely fail for `address(0)` due to invalid signatures, there is no explicit guard. More concerning, `from == address(this)` is not checked -- if the contract itself somehow had an authorization outstanding (unlikely but worth defending against), it could be used to drain escrowed funds.
**Proof of Concept**: Theoretical -- would require a valid ERC-3009 signature from `address(this)` or `address(0)`, which is practically impossible but defense-in-depth suggests guarding against it.
**Recommendation**: Add explicit validation:
```solidity
require(from != address(0), "X402: zero payer");
require(from != address(this), "X402: contract cannot be payer");
```

---

## [G-14] `Payment` struct stores redundant `endpoint` string, increasing storage costs
**Severity**: Info
**Category**: evm-audit-general
**Location**: `Payment` struct, line 64
**Description**: The `endpoint` field is a `string` stored in the `Payment` struct on-chain. Strings in storage are expensive. Since `endpoint` is only used in `verifyPayment` for comparison and in the `PaymentReceived` event, consider storing only the hash (`keccak256(bytes(endpoint))`) to save gas on settlement.
**Proof of Concept**: N/A -- gas optimization.
**Recommendation**: Store `bytes32 endpointHash` instead of `string endpoint` and compare hashes directly. The full endpoint string is already emitted in the event for off-chain indexing.

---

## [G-15] Owner can remove token support while payments in that token are still in escrow
**Severity**: Low
**Category**: evm-audit-general
**Location**: `setSupportedToken()` lines 420-427, `release()` lines 334-349
**Description**: The owner can call `setSupportedToken(token, false)` while there are still active escrows denominated in that token. This does not prevent `release()` or `refund()` from executing (they do not check `supportedTokens`), so existing escrows are safe. However, it does prevent new settlements in that token, which could be confusing if documented as "removing support" without clarifying that existing escrows are unaffected. This is informational since the release/refund paths work correctly regardless.
**Proof of Concept**: N/A -- existing escrows function correctly after token removal.
**Recommendation**: Document in NatSpec that removing token support only affects new settlements, not existing escrows.
