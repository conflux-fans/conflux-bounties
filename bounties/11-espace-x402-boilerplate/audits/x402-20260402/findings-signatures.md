# Signature Security Audit Findings — X402PaymentVerifier

**Contract**: `X402PaymentVerifier.sol`
**Date**: 2026-04-02
**Auditor**: Claude Opus 4.6
**Category**: evm-audit-signatures

---

## Scope & Context

The `X402PaymentVerifier` contract does **not** perform its own `ecrecover` or EIP-712 signature verification. It delegates all cryptographic signature operations to the underlying ERC-3009 token via `receiveWithAuthorization()`. The ERC-3009 token is responsible for verifying the EIP-712 typed signature (including chain ID, verifying contract, nonce, and signer recovery).

This means many checklist items related to raw `ecrecover`, EIP-712 domain separator construction, signature malleability, and `address(0)` recovery are **not directly applicable** to this contract -- those concerns live in the ERC-3009 token implementation. However, the contract does have its own nonce-tracking layer and design decisions that interact with the signature security model.

---

## [SIG-1] `abi.encodePacked` with two arguments for nonce key is safe but fragile

**Severity**: Info
**Category**: evm-audit-signatures
**Location**: `settle()` lines 282, 293
**Description**: The contract uses `keccak256(abi.encodePacked(from, nonce))` to derive the nonce key. Since `from` is `address` (fixed 20 bytes) and `nonce` is `bytes32` (fixed 32 bytes), there is no hash collision risk from `abi.encodePacked` -- both are fixed-size types. However, using `abi.encode` would be more defensive and consistent with best practices, guarding against future refactoring that might introduce dynamic types.
**Proof of Concept**: No exploit -- both types are fixed-size so no collision is possible.
**Recommendation**: Consider using `abi.encode` instead of `abi.encodePacked` for defense in depth:
```solidity
keccak256(abi.encode(from, nonce))
```

---

## [SIG-2] Redundant nonce tracking creates false sense of security without preventing replay

**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `settle()` lines 282-293
**Description**: The contract maintains its own `usedNonces` mapping to track ERC-3009 authorization nonces. However, the ERC-3009 token contract itself already tracks and enforces nonce uniqueness via `authorizationState()`. The contract's nonce tracking is redundant with the token's native replay protection. More importantly, the contract's nonce check uses `keccak256(abi.encodePacked(from, nonce))` as the key, but this is scoped only within this contract -- it provides no cross-contract replay protection (which ERC-3009's own nonce tracking already handles). The redundancy is benign but adds gas cost and could mislead auditors into thinking the contract is independently preventing replay, when in reality the ERC-3009 token's `receiveWithAuthorization` would revert on a replayed nonce regardless.
**Proof of Concept**: 1. A valid ERC-3009 authorization is settled via `settle()`. 2. The contract marks the nonce as used in `usedNonces`. 3. Attempting replay would fail at line 282, but would also fail at the `receiveWithAuthorization` call (line 297) due to the token's own nonce enforcement. The contract's check is purely redundant.
**Recommendation**: The redundant check is a reasonable belt-and-suspenders approach (fail fast before the external call), but document that the primary replay protection comes from the ERC-3009 token, not from the contract's own `usedNonces` mapping.

---

## [SIG-3] No chain ID or verifying contract binding in the contract's own invoice model

**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `settle()` line 281, `Payment` struct
**Description**: The `invoiceId` is an opaque `bytes32` value provided by the seller. The contract itself does not include `block.chainid` or `address(this)` in any hash it computes or verifies. While the underlying ERC-3009 signature includes the token's EIP-712 domain (with chain ID and verifying contract of the *token*), the `X402PaymentVerifier` contract's own `invoiceId` namespace is not chain-scoped. If the same contract is deployed at the same address on multiple chains (e.g., via CREATE2), a seller could potentially create confusion by using the same `invoiceId` on different chains, and off-chain systems querying `verifyPayment()` might not distinguish which chain the payment was made on. This is primarily an off-chain integration risk rather than a direct on-chain exploit, since the ERC-3009 authorization itself is chain-bound.
**Proof of Concept**: 1. Deploy `X402PaymentVerifier` at address `0xABC` on Conflux eSpace and a testnet fork. 2. Seller registers on both. 3. Buyer pays invoice `0x1234` on the fork. 4. Off-chain system queries `verifyPayment(0x1234)` on mainnet -- it returns false (not paid), but if the seller later settles the same `invoiceId` on mainnet with a different payer, there is no linkage or conflict detection across chains.
**Recommendation**: If the contract may be deployed on multiple chains, include `block.chainid` in event emissions or require `invoiceId` to be derived from a hash that includes chain-specific data. At minimum, document that `invoiceId` uniqueness is per-deployment, not cross-chain.

---

## [SIG-4] Seller controls invoiceId -- no binding to payer's signed authorization parameters

**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `settle()` lines 263-325
**Description**: The `invoiceId` is chosen by the seller (the caller of `settle()`) and is not included in the payer's ERC-3009 signature. This means the `invoiceId`-to-payment mapping is entirely under seller control. A malicious seller could associate any `invoiceId` with any valid ERC-3009 authorization, or settle the same payer authorization under a misleading `invoiceId`. While the ERC-3009 nonce prevents double-spending the same authorization, the invoiceId binding is a trust assumption on the seller. Off-chain systems relying on `verifyPayment(invoiceId, ...)` trust that the seller correctly mapped the invoice to the authorization.
**Proof of Concept**: 1. Payer signs ERC-3009 authorization for 100 USDC to this contract. 2. Seller calls `settle()` with `invoiceId = keccak256("invoice-for-premium-service")` but the payer intended to pay for a different service. 3. `verifyPayment` returns `true` for the premium service invoiceId even though the payer never agreed to that specific invoice mapping.
**Recommendation**: Document that the seller is trusted to correctly bind `invoiceId` to the payer's intent. Alternatively, require the payer to include the `invoiceId` in additional signed data (though this would require changes to the ERC-3009 flow).

---

## [SIG-5] `receiveWithAuthorization` front-running is mitigated but the `to` field must match `address(this)`

**Severity**: Info
**Category**: evm-audit-signatures
**Location**: `settle()` line 297-305
**Description**: The contract correctly uses `receiveWithAuthorization` (not `transferWithAuthorization`), which restricts the caller to the `to` address in the signed authorization. Since the authorization's `to` is set to `address(this)` (line 299), only this contract can execute the authorization, preventing front-running by third parties. This is a correct and important design choice. However, the contract does not explicitly verify that the `to` parameter in the signed message equals `address(this)` before calling -- it relies on the token contract to enforce this. If a payer signs an authorization with `to` set to a different address, the `receiveWithAuthorization` call will revert at the token level, which is correct behavior.
**Proof of Concept**: N/A -- this is an informational note confirming correct usage.
**Recommendation**: No action needed. The design correctly leverages `receiveWithAuthorization` to prevent front-running.

---

## [SIG-6] No expiration on the contract's payment record -- stale payments remain verifiable forever

**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `verifyPayment()` lines 358-371, `Payment` struct
**Description**: Once a payment is settled and not refunded, `verifyPayment()` returns `true` forever. The `expiry` field (from `validBefore`) is stored but never checked in `verifyPayment()`. There is no mechanism to expire old payment records. While the ERC-3009 authorization itself has a `validBefore` deadline, the payment record persists indefinitely. This means a payment made years ago can still be used to verify access to an endpoint, depending on how the off-chain system uses `verifyPayment()`.
**Proof of Concept**: 1. Buyer pays for endpoint access in 2026. 2. In 2030, `verifyPayment(invoiceId, amount, endpoint)` still returns `(true, payer)`. 3. If the off-chain system grants access based solely on this check, the buyer has perpetual access from a single payment.
**Recommendation**: Either check `p.expiry` in `verifyPayment()` or add a `validUntil` field to the `Payment` struct that the seller specifies during settlement:
```solidity
if (block.timestamp > p.expiry) return (false, address(0));
```

---

## [SIG-7] Signature malleability is delegated to token -- ensure ERC-3009 tokens use safe ECDSA

**Severity**: Info
**Category**: evm-audit-signatures
**Location**: `settle()` line 297
**Description**: The contract does not perform any `ecrecover` itself, so signature malleability (flipping `s` to `secp256k1.n - s`) is not directly exploitable in this contract. However, the contract's security depends on the registered ERC-3009 tokens implementing safe signature verification. If a supported token uses raw `ecrecover` without enforcing the lower-half `s` value, a malleable signature could potentially interact poorly with the token's own nonce tracking. This is a dependency risk, not a bug in this contract.
**Proof of Concept**: N/A -- depends on token implementation.
**Recommendation**: When adding supported tokens via `setSupportedToken()`, verify that the token's ERC-3009 implementation uses OpenZeppelin's ECDSA library or otherwise enforces `s` in the lower half of the curve order. Document this requirement in the `setSupportedToken()` NatSpec.
