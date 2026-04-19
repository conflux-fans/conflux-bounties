# Security Audit Findings Status

Audit date: 2026-03-29
Status review date: 2026-04-01

## Summary

| Status | Count |
|--------|-------|
| Addressed | 15 |
| Partially Addressed | 3 |
| Not Applicable | 1 |
| Outstanding | 2 |

## Findings

### F-01 -- invoiceId not included in ERC-3009 signature -- payment misbinding (High)

**Status:** Addressed
**Evidence:** Three layers of mitigation:
1. **Nonce derivation (ARCH-1):** The server now derives the ERC-3009 nonce from the invoiceId (`nonce = invoiceId`), so the client signs `hashNonce(invoiceId)` as the nonce in the EIP-712 authorization. On settlement, the server validates `auth.nonce === hashNonce(invoiceId)` (`apps/seller-api/src/routes/invoices.ts:95-98` and `apps/seller-api/src/dev.ts`). This cryptographically binds the authorization to a specific invoice without modifying the ERC-3009 type schema.
2. **Recipient gating:** The contract requires `msg.sender == recipient` (`X402PaymentVerifier.sol:247`), so only the intended seller can call `settle()`.
3. **Invoice ID hashing:** The seller API hashes the UUID invoice ID via `hashInvoiceId()` (`packages/shared/src/headers.ts:65-67`) before passing to the contract.
**Notes:** The nonce derivation approach was chosen over extending EIP-712 types because it preserves ERC-3009 standard compatibility. The nonce field is repurposed to carry invoice binding without changing the contract or type schema.

---

### F-02 -- Front-running settle() bypasses verifier payment tracking entirely (High)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:16-26` -- The `IERC3009` interface now declares `receiveWithAuthorization` (not `transferWithAuthorization`). `X402PaymentVerifier.sol:260` calls `IERC3009(token).receiveWithAuthorization(from, address(this), ...)` where `to = address(this)`. This means the verifier contract is the recipient in the ERC-3009 signature, so only the contract (as `msg.sender == to`) can execute the authorization. Front-runners cannot call `receiveWithAuthorization` directly because they are not the `to` address. The contract then forwards funds to the seller via `IERC20(token).safeTransfer(recipient, received)` at line 285.
**Notes:** The client SDK (`packages/x402-sdk/src/client.ts:114-116`) and web frontend both sign `ReceiveWithAuthorization` with `to = verifierAddr` (the contract address), confirming end-to-end consistency.

---

### F-03 -- Unbounded sellerList array -- permanent DoS of getActiveSellers() (High)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:181-201` -- `deactivateSeller()` now implements swap-and-pop removal from `sellerList`, using a `_sellerIndex` mapping (line 86) for O(1) lookup. When a seller is deactivated, the last element is swapped into the removed position and the array is popped (lines 191-198). `getActiveSellers()` at lines 383-396 now takes `(uint256 offset, uint256 limit)` pagination parameters, preventing unbounded iteration.
**Notes:** The `sellerList` now only contains active sellers. Registration still has no fee, so the DOS-2 economic attack vector (mass registration on L2) is partially mitigated by the array cleanup but not fully prevented. A registration fee is not implemented.

---

### F-04 -- PUSH0 opcode may not be supported on Conflux eSpace (High)

**Status:** Addressed
**Evidence:** `packages/contracts/hardhat.config.ts:10` -- `evmVersion: "paris"` is explicitly set in the Solidity compiler settings. This prevents the compiler from emitting the `PUSH0` opcode (introduced in Shanghai), ensuring compatibility with Conflux eSpace.
**Notes:** Exact match to the audit recommendation.

---

### F-05 -- Owner can force refunds without recipient consent (Medium)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:334` -- The `_refundTo()` internal function requires `msg.sender == p.recipient` (line 334: `require(msg.sender == p.recipient, "X402: only recipient can refund")`). The owner is no longer authorized to initiate refunds. Only the payment recipient (seller) can call `refund()` or `refundTo()`.
**Notes:** The owner authorization path has been completely removed from the refund flow, matching the audit recommendation.

---

### F-06 -- Immutable DOMAIN_SEPARATOR breaks on chain fork (Medium)

**Status:** Addressed
**Evidence:** `MockUSDT0.sol:27-28` -- The contract stores both `_cachedDomainSeparator` and `_cachedChainId` as immutable values. `MockUSDT0.sol:48-53` -- The `DOMAIN_SEPARATOR()` function dynamically recomputes when `block.chainid != _cachedChainId`, following the OpenZeppelin EIP712 pattern recommended by the audit.
**Notes:** Exact match to the audit recommendation.

---

### F-07 -- Compromised owner can brick the entire protocol (Medium)

**Status:** Partially Addressed
**Evidence:** The contract NatSpec at `X402PaymentVerifier.sol:351-352` documents that a multisig should be used as owner (`@dev Only non-fee-on-transfer, non-rebasing tokens should be added. Use a multisig as owner for production deployments.`). However, no on-chain multisig requirement, timelock, or role separation is enforced. The owner can still delist all tokens and deactivate all sellers instantly. The refund vector is mitigated (F-05 fix removes owner from refunds).
**Notes:** Documentation-level mitigation only. A timelock or multisig enforcement at the contract level is not implemented. The F-05 fix does remove one of the three attack vectors (force refunds).

---

### F-08 -- Blocklisted payer makes refund permanently impossible (Medium)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:325-328` -- A `refundTo(bytes32 invoiceId, address refundRecipient)` function is implemented, allowing the recipient to send refunds to an alternative address when the original payer is blocklisted. The SDK also exposes this via `X402Verifier.refundTo()` at `packages/x402-sdk/src/verifier.ts:143-160`.
**Notes:** Exact match to the audit recommendation.

---

### F-09 -- Fee-on-transfer tokens cause accounting mismatch (Medium)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:259-270` -- The `settle()` function now measures actual received tokens via `balanceOf` before and after the transfer: `uint256 balBefore = IERC20(token).balanceOf(address(this))` (line 259), then `uint256 received = IERC20(token).balanceOf(address(this)) - balBefore` (line 269). The `received` amount (not the nominal `value`) is stored in the payment record (line 276) and forwarded to the recipient (line 285). Additionally, the IERC3009 interface NatSpec (lines 10-12) and `setSupportedToken` NatSpec (line 351) document that only non-fee-on-transfer tokens should be used.
**Notes:** Both code fix (balance measurement) and documentation are in place.

---

### F-10 -- Rebasing tokens cause accounting drift (Medium)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:10-12` -- The IERC3009 interface NatSpec explicitly states: "Only non-fee-on-transfer, non-rebasing, standard ERC-20 tokens with ERC-3009 support should be registered. ERC-777 tokens are unsupported." The `setSupportedToken()` NatSpec at line 351 reiterates this.
**Notes:** Documentation-level mitigation as recommended. The contract cannot programmatically detect rebasing tokens, so documentation is the appropriate approach.

---

### F-11 -- ERC-777 tokens can trigger hooks during settlement (Medium)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:12` -- The IERC3009 interface NatSpec explicitly states "ERC-777 tokens are unsupported." The `nonReentrant` guard on `settle()` (line 240) provides defense in depth.
**Notes:** Documentation-level mitigation as recommended, plus existing reentrancy guard.

---

### F-12 -- Seller re-registration creates duplicate sellerList entries (Low)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:133` -- `registerSeller()` now checks `sellers[msg.sender].registeredAt == 0` (not just `!active`), preventing re-registration of previously registered sellers. A dedicated `reactivateSeller()` function exists at lines 151-163, which updates the seller's profile and re-adds them to `sellerList` without creating duplicates (since `deactivateSeller` now removes them via swap-and-pop).
**Notes:** Both recommendations implemented: `registeredAt == 0` check and `reactivateSeller()` function.

---

### F-13 -- Signature malleability -- no low-s enforcement (Low)

**Status:** Addressed
**Evidence:** `MockUSDT0.sol:5` -- The contract imports `@openzeppelin/contracts/utils/cryptography/ECDSA.sol`. Lines 107, 147, and 178 use `ECDSA.recover(digest, v, r, s)` instead of raw `ecrecover`. OpenZeppelin's `ECDSA.recover()` enforces the low-s requirement (rejects `s` values in the upper half of the curve order), preventing signature malleability.
**Notes:** Exact match to the audit recommendation. NatSpec at line 80 explicitly documents this: "Uses ECDSA.recover() which enforces low-s to prevent signature malleability."

---

### F-14 -- No ERC-3009 interface validation on supported tokens (Low)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:114` -- The constructor validates `_tokens[i].code.length > 0` for initial tokens. `X402PaymentVerifier.sol:357` -- `setSupportedToken()` validates `token.code.length > 0` when adding a token (`require(token.code.length > 0, "X402: token has no code")`). This prevents adding addresses with no deployed code.
**Notes:** The code-existence check is implemented. A full ERC-3009 interface validation (e.g., via static call to `authorizationState`) is not implemented, but the code-existence check prevents the silent-success-on-empty-address attack.

---

### F-15 -- Instant token delisting with no grace period (Low)

**Status:** Outstanding
**Evidence:** `X402PaymentVerifier.sol:354-361` -- `setSupportedToken()` still instantly toggles the `supportedTokens` mapping with no timelock or grace period. There is no `tokenDelistTime` mapping or delayed enforcement.
**Notes:** Not implemented. In-flight authorizations for a delisted token will fail immediately.

---

### F-16 -- renounceOwnership() can permanently brick admin functions (Low)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:121-123` -- `renounceOwnership()` is overridden to revert: `function renounceOwnership() public pure override { revert("X402: renounce disabled"); }`.
**Notes:** Exact match to the audit recommendation.

---

### F-17 -- Off-by-one in ERC-3009 time boundaries (Low)

**Status:** Not Applicable
**Evidence:** `MockUSDT0.sol:93-94` -- The time checks still use strict inequalities (`block.timestamp > validAfter` and `block.timestamp < validBefore`), which matches the ERC-3009 specification. The audit itself noted this is spec-compliant and only requires documentation.
**Notes:** This is by design per ERC-3009. The `x402.ts` middleware sets `expiry = Math.floor(Date.now() / 1000) + INVOICE_EXPIRY_SECONDS` providing sufficient margin. No code change needed.

---

### F-18 -- Decimal-unaware verifyPayment() comparison (Low)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:293-295` -- The `verifyPayment()` NatSpec now documents: `@dev expectedAmount must use the token's native decimal scaling.` The IERC3009 interface comment (lines 10-12) and `setSupportedToken()` comment (line 351) also establish the token requirements.
**Notes:** Documentation-level mitigation as recommended. The off-chain middleware (`apps/seller-api/src/middleware/x402.ts:102`) correctly uses `TOKEN_DECIMALS` from the shared package for display formatting while passing raw amounts to the contract.

---

### F-19 -- No maximum authorization lifetime enforced (Low)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:48` -- `uint256 public constant MAX_AUTH_DURATION = 7 days;` is defined. `X402PaymentVerifier.sol:250-252` -- The `settle()` function enforces: `require(validBefore <= block.timestamp + MAX_AUTH_DURATION, "X402: auth expires too far in future")`. Line 253 also adds an explicit expiry check: `require(block.timestamp < validBefore, "X402: authorization expired")`.
**Notes:** Both a maximum lifetime and an explicit expiry check are enforced at the verifier level.

---

### F-20 -- MockUSDT0 mint() has no access control (Info)

**Status:** Partially Addressed
**Evidence:** `MockUSDT0.sol:71-73` -- The `mint()` function remains unrestricted (`external` with no access modifier). However, the contract-level NatSpec at lines 13-14 now explicitly warns: "WARNING: mint() is unrestricted -- this contract is for TESTNET ONLY. On mainnet, use the real USDT0 token on Conflux eSpace."
**Notes:** The warning documentation is present. No `onlyOwner` modifier was added. This is acceptable since the contract is explicitly a testnet mock, but the finding remains partially addressed since the code itself is still unrestricted.

---

### F-21 -- Unused balanceOf() in IERC3009 interface (Info)

**Status:** Addressed
**Evidence:** `X402PaymentVerifier.sol:15-29` -- The `IERC3009` interface now only declares `receiveWithAuthorization()` and `authorizationState()`. The `balanceOf()` and `transferWithAuthorization()` declarations have been removed. Balance checks in `settle()` (line 259) use `IERC20(token).balanceOf()` from the imported OpenZeppelin `IERC20` interface instead.
**Notes:** The interface is now minimal and contains only the functions actually used via the ERC-3009 path.

---

## Additional Observations

### Cross-Cutting: F-01 + F-02 Combined Attack

The combined attack described in the audit report (front-run settlement AND misbind payments) is substantially mitigated:
- F-02 is fully addressed via `receiveWithAuthorization` (contract must be `to`)
- F-01 is partially addressed via `msg.sender == recipient` (only seller can bind invoiceId)

The residual risk is a malicious seller misbinding within their own system, which is a trust-model issue rather than a contract vulnerability.

### DOS-2: Mass Seller Registration on L2

While `getActiveSellers()` is now paginated (F-03 addressed) and the swap-and-pop cleanup is implemented, there is still no registration fee. Mass registration remains economically feasible on Conflux eSpace. The `sellerList` will be cleaned up on deactivation, but an attacker who registers and does not deactivate would still bloat storage. This is partially mitigated but not fully prevented.

### Off-Chain Mitigations

Several findings benefit from off-chain mitigations in the seller API:
- **Rate limiting**: `apps/seller-api/src/routes/invoices.ts:14-38` implements per-IP rate limiting (5 settlements/minute)
- **Pre-validation**: `invoices.ts:93-127` performs off-chain EIP-712 signature verification before spending gas on-chain (`facilitatorGasSaved` metric tracks rejections)
- **Invoice expiry**: `apps/seller-api/src/middleware/x402.ts:77` sets time-bounded invoice expiry
- **Payer binding**: `x402.ts:46-49` checks `x-payment-payer` header against the original payer to prevent replay by third parties
