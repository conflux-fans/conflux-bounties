# Signature Security Audit Findings -- X402PaymentVerifier.sol

**Contract**: `X402PaymentVerifier.sol`
**Date**: 2026-04-02
**Auditor**: Claude Opus 4.6
**Category**: evm-audit-signatures

---

## [SIG-1] Same ERC-3009 authorization can be settled under different invoiceIds
**Severity**: High
**Category**: evm-audit-signatures
**Location**: `settle()`
**Description**: The ERC-3009 signature covers `(from, to, value, validAfter, validBefore, nonce)` but does NOT cover `invoiceId`. The contract's `usedNonces` mapping keys on `keccak256(abi.encode(from, nonce))`, which prevents reuse of the same `(from, nonce)` pair within a single deployment. However, if the contract is deployed on multiple chains (see SIG-3), the same authorization can be settled under completely different invoiceIds on each chain, because the contract-level nonce is per-deployment. On a single chain, only one settlement can succeed (the token's internal nonce prevents double-spend), but the invoiceId chosen by the recipient is entirely unbound to the signed data -- meaning the recipient controls which invoice is recorded against the buyer's payment.
**Proof of Concept**: 1) Buyer signs ERC-3009 authorization with nonce N. 2) Recipient calls `settle()` with invoiceId_A. 3) On a second chain where the same token and contract are deployed, the recipient calls `settle()` with invoiceId_B using the same authorization. 4) Both succeed because each chain has independent `usedNonces` storage and independent token nonce state. The buyer is charged twice.
**Recommendation**: The contract cannot unilaterally prevent cross-chain replay of ERC-3009 authorizations (that depends on the token's EIP-712 domain separator including chainId). However, introducing a buyer-signed outer message that commits to `(invoiceId, recipient, token, amount, chainId, verifierAddress)` would provide end-to-end binding. At minimum, document that cross-chain safety depends entirely on the token's domain separator.

---

## [SIG-2] invoiceId is not bound to the signature -- recipient controls invoice attribution
**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `settle()`
**Description**: The `invoiceId` parameter is caller-supplied and is not part of the ERC-3009 signed payload. Since `msg.sender == recipient` is enforced, the recipient chooses which invoiceId to associate with a buyer's authorization. The buyer has no cryptographic assurance that their payment will be recorded under the correct invoice. A malicious or buggy recipient could settle a buyer's authorization against the wrong invoice, misattributing the payment. The `endpoint` string is similarly unbound to the signature. Off-chain systems relying on `verifyPayment(invoiceId, ...)` must trust the seller's correct behavior.
**Proof of Concept**: 1) Buyer authorizes payment intending it for invoice "INV-001". 2) Recipient calls `settle()` but passes invoiceId corresponding to "INV-002". 3) The payment is recorded under INV-002. The buyer's on-chain record shows payment for a different invoice than intended. 4) `verifyPayment()` returns true for INV-002, granting access to something the buyer did not pay for, while INV-001 shows unpaid.
**Recommendation**: Require the buyer to sign an additional application-level EIP-712 message that commits to `(invoiceId, recipient, amount, token, endpoint)`. Verify this signature in `settle()`. This gives the buyer cryptographic control over which invoice their funds are applied to.

---

## [SIG-3] Cross-chain replay of ERC-3009 authorizations
**Severity**: High
**Category**: evm-audit-signatures
**Location**: `settle()`
**Description**: ERC-3009's `receiveWithAuthorization` uses EIP-712 typed data which includes a `DOMAIN_SEPARATOR` with `chainId`. If the same token contract is deployed at the same address on multiple chains (common for bridged stablecoins like USDC via CREATE2), the domain separator should differ due to chainId, preventing cross-chain replay at the token level. However, (a) some token implementations cache the domain separator at construction and do not recompute on chain forks, (b) non-compliant implementations may omit chainId, and (c) the X402PaymentVerifier contract itself has zero chain-specific replay protection -- its `usedNonces` mapping is per-deployment and provides no cross-chain linkage. The contract relies entirely on the token's EIP-712 domain separator for cross-chain safety, which is an external trust assumption that is not validated or documented.
**Proof of Concept**: 1) X402PaymentVerifier deployed on Conflux eSpace and another EVM chain at the same address. 2) Same ERC-3009 token deployed at the same address on both chains. 3) If the token's domain separator does not include chainId (or uses a cached separator from before a chain fork), buyer signs one authorization. 4) Recipient settles on chain A, then replays on chain B with a different invoiceId. 5) Buyer is charged twice.
**Recommendation**: When registering supported tokens, verify that the token's EIP-712 domain separator includes `block.chainid` and is computed dynamically (not cached). Document this requirement. Consider emitting `block.chainid` in settlement events so off-chain systems can distinguish cross-chain payments.

---

## [SIG-4] Redundant nonce tracking creates gas overhead without additional security
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `settle()`
**Description**: The contract maintains its own `usedNonces` mapping keyed by `keccak256(abi.encode(from, nonce))`, while the ERC-3009 token also tracks authorization nonces internally via `authorizationState(authorizer, nonce)`. The contract imports the `IERC3009` interface which includes `authorizationState()` but never calls it. The redundancy is benign because if the token-level `receiveWithAuthorization` reverts, the entire transaction reverts (no try/catch), so the contract's nonce is never marked without a successful token transfer. However, the redundant SSTORE costs approximately 20,000 gas per cold write, and could mislead auditors into thinking the contract independently prevents replay when the token's own nonce enforcement is what actually matters.
**Proof of Concept**: Not directly exploitable. Each settlement pays an unnecessary 20,000 gas for the redundant nonce write.
**Recommendation**: Either (a) remove `usedNonces` and use the token's `authorizationState()` as a pre-check: `require(!IERC3009(token).authorizationState(from, nonce), "X402: nonce used")`, or (b) keep the redundant check as belt-and-suspenders but document that primary replay protection comes from the token. If keeping it, consider making the key more specific (include `invoiceId`, `token`, `recipient`) to provide value beyond the token's tracking.

---

## [SIG-5] `receiveWithAuthorization` correctly prevents third-party front-running
**Severity**: Info
**Category**: evm-audit-signatures
**Location**: `settle()`
**Description**: The contract correctly uses `receiveWithAuthorization` (not `transferWithAuthorization`). In ERC-3009, `receiveWithAuthorization` requires `msg.sender == to`, where `to` is part of the signed payload. Since the contract passes `to = address(this)`, only this contract can execute the authorization at the token level. A third party cannot front-run by calling `receiveWithAuthorization` directly on the token contract because they are not `address(this)`. Additionally, `msg.sender == recipient` is enforced in `settle()`, so only the registered seller can trigger settlement. This is the correct pattern and prevents the front-running attack that affects `transferWithAuthorization` (where anyone can submit the transaction).
**Proof of Concept**: N/A -- confirming correct design.
**Recommendation**: No change needed. Document this design choice so future maintainers understand why `receiveWithAuthorization` was chosen over `transferWithAuthorization`.

---

## [SIG-6] Signature malleability at the ERC-3009 level is not validated by the contract
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `settle()`
**Description**: The contract passes raw `(v, r, s)` values to `receiveWithAuthorization()` without validating that `s` is in the lower half of the secp256k1 curve order (the EIP-2 canonical form). Well-implemented ERC-3009 tokens (like Circle's USDC) enforce this check internally and reject malleable signatures. However, if a supported token does NOT enforce EIP-2, an attacker could compute the malleable counterpart `(v ^ 1, r, secp256k1_n - s)` from an observed pending transaction. On a single chain, the token's own nonce tracking prevents double-spend regardless of malleability. The risk is limited to scenarios where malleable signatures interact with the contract's `usedNonces` tracking in unexpected ways -- but since the entire transaction reverts if the token call fails, no state is corrupted.
**Proof of Concept**: Theoretical. 1) Observe a valid `settle()` in the mempool. 2) Compute the malleable signature. 3) Attempt `settle()` with the malleable signature and a different invoiceId. 4) On compliant tokens, the token rejects the malleable signature. On non-compliant tokens, the token's nonce was already consumed by the first transaction. No double-spend is possible, but the attempt wastes gas.
**Recommendation**: Add a pre-check validating `s <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0` before calling `receiveWithAuthorization()` as defense-in-depth. This is especially important if the contract may support tokens with non-standard ECDSA implementations.

---

## [SIG-7] No chain ID or verifying contract in the contract's own nonce/invoice namespace
**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `settle()`, `Payment` struct
**Description**: The contract does not include `block.chainid` or `address(this)` in any hash it computes. The `usedNonces` key is `keccak256(abi.encode(from, nonce))` without chain or contract scoping. The `invoiceId` is an opaque caller-supplied `bytes32` with no chain binding. If the same contract is deployed at the same address on multiple chains via CREATE2, the `invoiceId` namespace is shared across chains only conceptually (each deployment has independent storage), but off-chain systems querying `verifyPayment()` have no on-chain indicator of which chain a payment belongs to. Events emitted by `settle()` do not include `block.chainid`. This creates integration confusion when the contract operates across multiple chains.
**Proof of Concept**: 1) Deploy X402PaymentVerifier at the same address on Conflux eSpace and Ethereum mainnet. 2) Buyer pays invoiceId `0x1234` on Conflux. 3) Off-chain system queries both chains for `0x1234` -- no chain-discriminating field helps distinguish which is canonical. 4) Seller could settle the same invoiceId on both chains with different payers, creating conflicting records.
**Recommendation**: Include `block.chainid` in event emissions. Consider requiring `invoiceId` to be derived from a hash that includes chain-specific data, or add a `chainId` field to the `Payment` struct.

---

## [SIG-8] No validation that `from` matches the actual signer -- delegated to token
**Severity**: Info
**Category**: evm-audit-signatures
**Location**: `settle()`
**Description**: The contract accepts `from` as a caller-supplied parameter and passes it to `receiveWithAuthorization()`. It does not independently verify that `from` is the actual signer of the ERC-3009 authorization. This is safe because the token's `receiveWithAuthorization` recovers the signer from the EIP-712 signature and compares it to `from`, reverting if they do not match. The `from` value stored in `payments[invoiceId].payer` is written before the external call, but since the entire transaction reverts if the token call fails, no incorrect `payer` value persists. The IERC3009 interface is correctly defined to match the standard function signature.
**Proof of Concept**: N/A -- if an attacker supplies a wrong `from`, `receiveWithAuthorization` reverts at the token level, the entire transaction reverts, and no state changes persist.
**Recommendation**: No change needed. The delegation of signer verification to the token contract is the correct pattern for ERC-3009 integration. Consider adding a NatSpec comment noting that `from` validation is performed by the token.
