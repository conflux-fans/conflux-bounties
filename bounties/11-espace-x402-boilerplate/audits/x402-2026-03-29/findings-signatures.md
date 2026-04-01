# Signature Audit Findings -- X402PaymentVerifier.sol & MockUSDT0.sol

**Audit Date**: 2026-03-29
**Category**: evm-audit-signatures
**Contracts**: `X402PaymentVerifier.sol`, `MockUSDT0.sol`

---

## [SIG-1] DOMAIN_SEPARATOR cached at deployment breaks on chain fork
**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `MockUSDT0.constructor()`
**Description**: `DOMAIN_SEPARATOR` is computed once in the constructor and stored as `immutable`. If the chain forks (e.g., an EVM hard fork that changes `block.chainid`), the cached `DOMAIN_SEPARATOR` will still contain the old chain ID. Signatures valid on one fork become valid on the other, enabling cross-chain replay of `transferWithAuthorization`, `receiveWithAuthorization`, and `cancelAuthorization`.
**Proof of Concept**:
1. User signs a `transferWithAuthorization` on the original chain.
2. A chain fork occurs, producing a new chain with a different `block.chainid`.
3. The `DOMAIN_SEPARATOR` is immutable, so it still embeds the old chain ID.
4. An attacker replays the exact same signature on the forked chain and it succeeds.
**Recommendation**: Compute the domain separator dynamically when `block.chainid` differs from the deployment chain ID, following the pattern used in OpenZeppelin's `EIP712` base contract:
```solidity
uint256 private immutable _deploymentChainId;
bytes32 private immutable _cachedDomainSeparator;

constructor() {
    _deploymentChainId = block.chainid;
    _cachedDomainSeparator = _computeDomainSeparator();
}

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    return block.chainid == _deploymentChainId
        ? _cachedDomainSeparator
        : _computeDomainSeparator();
}
```

---

## [SIG-2] ecrecover returns address(0) -- zero-address signer could forge authorizations
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `MockUSDT0.transferWithAuthorization()`, `receiveWithAuthorization()`, `cancelAuthorization()`
**Description**: The contract correctly checks `recovered != address(0) && recovered == from`, which prevents the `ecrecover`-returns-zero attack. However, this guard is only present in `MockUSDT0`. The `X402PaymentVerifier.settle()` function itself performs **no** signature validation -- it delegates entirely to the token contract via `IERC3009(token).transferWithAuthorization(...)`. If a supported token has a buggy ERC-3009 implementation that does not check for `address(0)`, the verifier would accept fraudulent payments. The verifier has no defense-in-depth against a malformed token.
**Proof of Concept**:
1. Owner adds a token with a faulty ERC-3009 that does not reject `ecrecover == address(0)`.
2. Attacker calls `settle()` with garbage `v`, `r`, `s` values that make `ecrecover` return `address(0)` and `from = address(0)`.
3. If address(0) holds a balance (e.g., from accidental transfers), funds are moved.
**Recommendation**: This is inherent to the delegated-verification pattern. Document the trust assumption that only correctly-implemented ERC-3009 tokens should be added. Consider adding a post-condition check in `settle()`:
```solidity
// After transferWithAuthorization call:
require(from != address(0), "X402: zero payer");
```

---

## [SIG-3] Signature malleability -- dual valid (v, r, s) tuples
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `MockUSDT0.transferWithAuthorization()`, `receiveWithAuthorization()`, `cancelAuthorization()`
**Description**: ECDSA signatures have a known malleability property: for any valid `(v, r, s)`, there exists another valid tuple `(v', r, s')` where `s' = secp256k1.n - s` and `v'` is flipped. The `ecrecover` precompile accepts both. While the nonce-based replay protection in MockUSDT0 prevents the malleable signature from being used to execute a *second* transfer, the malleable form could be used by a front-runner to replace the original transaction's signature in the mempool (transaction-ordering manipulation). The contract does not enforce `s` to be in the lower half of the curve order as recommended by EIP-2.
**Proof of Concept**:
1. User broadcasts `transferWithAuthorization(from, to, value, ..., v, r, s)`.
2. Attacker observes the pending transaction, computes the malleable `(v', r, s')`.
3. Attacker submits the same call with the flipped signature, potentially front-running the original sender to claim any relay reward or cause ordering-dependent side effects.
**Recommendation**: Enforce low-`s` signatures per EIP-2, or use OpenZeppelin's `ECDSA.recover()` which rejects high-`s` values:
```solidity
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
// Replace ecrecover with:
address recovered = ECDSA.recover(digest, v, r, s);
```

---

## [SIG-4] Missing msg.sender binding in settle() -- anyone can submit on behalf of payer
**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `X402PaymentVerifier.settle()`
**Description**: The `settle()` function does not verify that `msg.sender` is an authorized party (e.g., the payer, the recipient, or a registered relayer). Any address can call `settle()` with a valid ERC-3009 authorization and trigger the payment. While the ERC-3009 signature itself protects the funds flow, this means: (a) a third party can force-execute a payment the payer intended to cancel via `cancelAuthorization`, (b) the payer loses control over *when* the authorization is exercised, and (c) front-runners can race to settle and fill in arbitrary `invoiceId`/`endpoint` metadata, potentially associating the payment with the wrong invoice.
**Proof of Concept**:
1. Payer signs an ERC-3009 authorization for a future payment.
2. Payer decides to cancel and calls `cancelAuthorization` on the token.
3. Before the cancellation is mined, an attacker who observed the authorization parameters calls `settle()`, executing the payment.
**Recommendation**: Consider restricting `settle()` to specific callers, or at minimum require `msg.sender == from || msg.sender == recipient`:
```solidity
require(
    msg.sender == from || msg.sender == recipient,
    "X402: unauthorized settler"
);
```

---

## [SIG-5] Missing parameter binding in signature -- invoiceId is not signed
**Severity**: High
**Category**: evm-audit-signatures
**Location**: `X402PaymentVerifier.settle()`
**Description**: The `invoiceId` parameter is a critical piece of business logic that determines which invoice is marked as paid. However, it is **not** included in the ERC-3009 signature. This means a valid authorization signature can be associated with *any* `invoiceId` by whichever party calls `settle()`. An attacker or malicious relayer can take a legitimate signed authorization and attribute it to a different invoice, marking the wrong invoice as paid while leaving the intended invoice unpaid. Similarly, the `endpoint` string is caller-controlled and unsigned.
**Proof of Concept**:
1. Payer signs an ERC-3009 authorization to pay 100 USDT to Merchant for Invoice-A.
2. Attacker calls `settle(invoiceB, ...)` with the same signature parameters.
3. Invoice-B is now marked as paid; Invoice-A remains unpaid.
4. If the payer's nonce is now consumed, they cannot re-pay Invoice-A without a new authorization.
**Recommendation**: Either: (a) include `invoiceId` in the signed payload by using a custom EIP-712 type instead of raw ERC-3009, or (b) derive `invoiceId` deterministically from the signed fields (e.g., `invoiceId = keccak256(abi.encode(from, recipient, value, nonce))`), or (c) require `msg.sender == recipient` so only the intended merchant can bind the payment:
```solidity
// Option (b): deterministic invoiceId
bytes32 invoiceId = keccak256(abi.encode(from, recipient, value, nonce));
```

---

## [SIG-6] Permit front-running griefing on settle()
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `X402PaymentVerifier.settle()`
**Description**: The `settle()` function can be front-run. Since anyone can call `settle()` with the same parameters (the signature is not bound to `msg.sender`), an attacker monitoring the mempool can extract the authorization parameters from a pending `settle()` transaction and submit their own `settle()` with the same data but a different `invoiceId`. The original transaction then reverts with "X402: already paid" (if same invoiceId) or the nonce is consumed (if different invoiceId, see SIG-5). This is a variant of permit front-running griefing where the relayer's transaction is wasted.
**Proof of Concept**:
1. Relayer submits `settle(invoiceA, token, from, recipient, value, ..., v, r, s)`.
2. Attacker front-runs with `settle(invoiceA, token, from, recipient, value, ..., v, r, s)`.
3. The attacker's transaction succeeds; the relayer's transaction reverts.
4. Alternatively, attacker uses a different `invoiceId` to misbind the payment.
**Recommendation**: Bind `settle()` to `msg.sender` (see SIG-4 recommendation), or use a commit-reveal scheme, or accept this as a known property of permissionless relaying and ensure the business layer handles it.

---

## [SIG-7] No signature expiration enforcement at the verifier level
**Severity**: Low
**Category**: evm-audit-signatures
**Location**: `X402PaymentVerifier.settle()`
**Description**: The `settle()` function stores `validBefore` as `expiry` in the payment record but does not itself enforce `block.timestamp < validBefore`. It relies entirely on the token's ERC-3009 implementation to reject expired authorizations. If a supported token has a weak or missing expiry check, the verifier provides no fallback protection. Additionally, there is no maximum lifetime enforced -- a payer could sign an authorization with `validBefore = type(uint256).max`, granting a perpetual license to anyone holding the signature to trigger the payment at any future time.
**Proof of Concept**:
1. Payer signs authorization with `validBefore = type(uint256).max`.
2. Years later, an attacker who obtained the signature parameters calls `settle()`.
3. If the payer still holds a token balance, the payment is executed.
**Recommendation**: Enforce a maximum authorization lifetime at the verifier level:
```solidity
require(block.timestamp < validBefore, "X402: authorization expired");
require(validBefore - validAfter <= MAX_AUTH_DURATION, "X402: auth window too long");
```

---

## [SIG-8] Nonce-less replay between X402PaymentVerifier and token contract
**Severity**: Medium
**Category**: evm-audit-signatures
**Location**: `X402PaymentVerifier.settle()` and `MockUSDT0.transferWithAuthorization()`
**Description**: The verifier maintains its own `usedNonces` mapping, and the token maintains a separate `authorizationState` mapping. These are the same nonce value but tracked independently. The verifier marks the nonce used *before* calling the token, but if the token call reverts (e.g., insufficient balance), the verifier's state change is also rolled back (within the same transaction). This is fine. However, the inverse is not protected: someone can call `transferWithAuthorization` directly on the token (bypassing the verifier), consuming the token-level nonce. Later, if anyone tries to `settle()` with the same parameters, the token call reverts, but the verifier has already marked `usedNonces[nonce] = true` and written to `payments[invoiceId]`. Due to `nonReentrant` and the revert propagation, this scenario actually does roll back. The real concern is that a valid ERC-3009 authorization can be executed directly on the token without going through the verifier at all, meaning the verifier's payment tracking can be bypassed entirely.
**Proof of Concept**:
1. Payer signs an ERC-3009 authorization to pay Merchant.
2. Anyone calls `MockUSDT0.transferWithAuthorization(...)` directly, bypassing the verifier.
3. Funds move from payer to recipient, but the verifier has no record -- `payments[invoiceId]` is never written.
4. The business layer that depends on the verifier's state believes the invoice is unpaid.
**Recommendation**: Use `receiveWithAuthorization` instead of `transferWithAuthorization` in the settle flow, and set `to = address(this)` (the verifier contract), then forward funds to the recipient. This ensures only the verifier can execute the authorization:
```solidity
// In settle():
IERC3009(token).receiveWithAuthorization(from, address(this), value, ...);
IERC20(token).safeTransfer(recipient, value);
```

---

## [SIG-9] Unrestricted mint function in MockUSDT0
**Severity**: Info
**Category**: evm-audit-signatures
**Location**: `MockUSDT0.mint()`
**Description**: The `mint()` function has no access control -- anyone can mint arbitrary amounts of tokens. This is expected for a mock/test contract but must never be deployed to production. If accidentally deployed to mainnet, it would render the token valueless and break all payment guarantees in the verifier.
**Proof of Concept**: Call `MockUSDT0.mint(attacker, type(uint256).max)`.
**Recommendation**: Ensure this contract is only used in test environments. Add a prominent comment or use a deploy-time guard. For production, use the real USDT0 token contract.
