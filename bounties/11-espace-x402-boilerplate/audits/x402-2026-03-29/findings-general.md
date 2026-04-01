# General Audit Findings - X402PaymentVerifier & MockUSDT0

**Date**: 2026-03-29
**Auditor**: Claude Opus 4.6
**Scope**: `X402PaymentVerifier.sol`, `MockUSDT0.sol`
**Checklist**: evm-audit-general

---

## [G-1] Refund relies on safeTransferFrom requiring recipient approval, likely always reverts
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `refund()` in X402PaymentVerifier.sol
**Description**: The `refund()` function calls `IERC20(token).safeTransferFrom(recipient, payer, amount)`, which requires the `recipient` to have granted an ERC-20 allowance to the `X402PaymentVerifier` contract for at least `amount`. Since `settle()` transfers funds directly from payer to recipient via `transferWithAuthorization` (the contract never holds the funds), the recipient must separately approve the verifier contract before a refund can execute. This makes the refund mechanism unreliable in practice -- the recipient (or owner acting on their behalf) can call `refund()` but it will revert unless the recipient has pre-approved the contract.
**Proof of Concept**:
1. Payer settles an invoice. Funds go directly to recipient.
2. Recipient calls `refund(invoiceId)`.
3. Transaction reverts with "ERC20: insufficient allowance" because recipient never approved the verifier contract.
**Recommendation**: Either (a) hold funds in escrow within the contract during a refund window, or (b) document clearly that `refund()` requires the recipient to first call `token.approve(verifierAddress, amount)`, or (c) replace with a pull-based refund where the recipient transfers directly to the payer outside the contract.

---

## [G-2] Direct token transfers bypass payment accounting
**Severity**: Medium
**Category**: evm-audit-general
**Location**: `settle()` in X402PaymentVerifier.sol
**Description**: The `settle()` function uses `transferWithAuthorization` to send tokens directly from `from` to `recipient` -- the contract never holds custody. However, the `payments` mapping records accounting as if the contract mediated the transfer. If the underlying `transferWithAuthorization` call reverts (e.g., insufficient balance, expired auth), the transaction reverts entirely, which is correct. But if a recipient receives tokens via a direct transfer outside of `settle()`, there is no accounting entry. More critically, anyone can front-run a `settle()` call by calling `transferWithAuthorization` directly on the token contract with the same authorization parameters, causing the funds to transfer but the `settle()` call to then revert (since the ERC-3009 nonce is consumed). The payer's funds are transferred but no payment record is created.
**Proof of Concept**:
1. Payer signs a `transferWithAuthorization` for recipient.
2. Attacker (or anyone) calls `IERC3009(token).transferWithAuthorization(...)` directly on the token contract with the same parameters.
3. Funds transfer from payer to recipient, ERC-3009 nonce is consumed.
4. When `settle()` is called, the `transferWithAuthorization` inside it reverts because the nonce is already used.
5. The `usedNonces` in the verifier is not set, and no `Payment` record is created, even though funds moved.
**Recommendation**: Consider using `receiveWithAuthorization` instead, which requires `msg.sender == to`, preventing third parties from front-running the authorization. Alternatively, have the contract be the initial recipient (escrow) and then forward funds, so the contract has custody-based accounting.

---

## [G-3] Unbounded loop in getActiveSellers() is a DoS vector
**Severity**: Low
**Category**: evm-audit-general
**Location**: `getActiveSellers()` in X402PaymentVerifier.sol
**Description**: `getActiveSellers()` iterates over the entire `sellerList` array twice (once to count, once to populate). Since `sellerList` only grows (sellers are never removed, only deactivated), this function will eventually consume more gas than the block gas limit, making it uncallable. While this is a `view` function and does not affect on-chain state transitions, off-chain consumers relying on it will break.
**Proof of Concept**:
1. Over time, thousands of sellers register.
2. `getActiveSellers()` call exceeds the gas limit for `eth_call` on the RPC node.
3. Any frontend or backend relying on this function fails.
**Recommendation**: Add pagination support (e.g., `getActiveSellers(uint256 offset, uint256 limit)`) or maintain a separate array of active sellers.

---

## [G-4] Seller re-registration is permanently blocked after deactivation
**Severity**: Low
**Category**: evm-audit-general
**Location**: `registerSeller()` / `deactivateSeller()` in X402PaymentVerifier.sol
**Description**: `registerSeller()` requires `!sellers[msg.sender].active`. After deactivation, `sellers[msg.sender].active` is `false`, but the `Seller` struct still exists with a non-zero `registeredAt`. The `registerSeller` check only looks at `.active`, so a deactivated seller CAN re-register, which will overwrite their struct. However, this pushes a duplicate entry into `sellerList`, inflating the array and wasting gas in `getActiveSellers()`.
**Proof of Concept**:
1. Alice calls `registerSeller(...)` -- pushed to `sellerList[0]`.
2. Alice is deactivated.
3. Alice calls `registerSeller(...)` again -- pushed to `sellerList[1]`.
4. `sellerList` now has two entries for Alice.
**Recommendation**: Track whether an address has ever been registered separately from whether it is active, or check for existing entries before pushing to `sellerList`.

---

## [G-5] External call to potentially non-existent token address in settle()
**Severity**: Low
**Category**: evm-audit-general
**Location**: `settle()` in X402PaymentVerifier.sol
**Description**: The owner can add any address as a supported token via `setSupportedToken()`. If a supported token address has no deployed code (e.g., token was self-destructed, or wrong address was added), the `transferWithAuthorization` call will succeed silently (returning true with empty returndata), because EVM calls to addresses with no code succeed with no revert. The payment would be recorded as successful even though no actual token transfer occurred.
**Proof of Concept**:
1. Owner calls `setSupportedToken(addressWithNoCode, true)`.
2. Attacker calls `settle()` with that token address.
3. The `IERC3009.transferWithAuthorization()` call succeeds silently (no code at address).
4. A `Payment` record is created for tokens that were never transferred.
**Recommendation**: Add a code-existence check before calling external token functions, e.g., `require(token.code.length > 0, "X402: token has no code")`.

---

## [G-6] PUSH0 opcode compatibility risk with Solidity ^0.8.24
**Severity**: Low
**Category**: evm-audit-general
**Location**: Both contracts, pragma line
**Description**: Solidity `>=0.8.20` uses the `PUSH0` opcode by default (introduced in the Shanghai/Shapella upgrade). Conflux eSpace or other target chains may not yet support the `PUSH0` opcode, which would cause deployment to fail or produce invalid bytecode. The pragma `^0.8.24` allows compilation with versions that emit `PUSH0`.
**Proof of Concept**: Compile with Solidity 0.8.24+ using default EVM target. Deploy to a chain that does not support `PUSH0`. Deployment fails or contract behaves unexpectedly.
**Recommendation**: Explicitly set the EVM version in the compiler settings to `paris` (or the latest EVM version supported by the target chain) to avoid `PUSH0` emission: `solc --evm-version paris` or in Hardhat config `evmVersion: "paris"`.

---

## [G-7] Off-by-one in MockUSDT0 time validation
**Severity**: Low
**Category**: evm-audit-general
**Location**: `transferWithAuthorization()` and `receiveWithAuthorization()` in MockUSDT0.sol
**Description**: The time checks use strict inequalities: `block.timestamp > validAfter` and `block.timestamp < validBefore`. This means an authorization where `validAfter = 0` (intended to be immediately valid) is not valid at `block.timestamp == 0` (genesis), though this is not practically exploitable. More relevantly, the `validBefore` check with `<` (strict less-than) means the authorization expires one second earlier than if `<=` were used. This matches the ERC-3009 reference implementation, so it is spec-compliant, but worth noting for integration correctness.
**Proof of Concept**: If `validBefore = 1000` and `block.timestamp = 1000`, the authorization is rejected. Integrators expecting "valid before" to be inclusive would be surprised.
**Recommendation**: Informational only. The behavior matches ERC-3009 spec. Document the boundary behavior for integrators.

---

## [G-8] MockUSDT0 mint function has no access control
**Severity**: Info
**Category**: evm-audit-general
**Location**: `mint()` in MockUSDT0.sol
**Description**: The `mint()` function is `external` with no access modifier, allowing anyone to mint arbitrary amounts of tokens. This is expected for a mock/test token but would be critical if deployed to a production environment.
**Proof of Concept**: Anyone calls `mint(attacker, 1_000_000e6)`.
**Recommendation**: Confirm this contract is strictly for testing. If it could be deployed to production, add `onlyOwner` or a minter role.

---

## [G-9] No validation that `from` parameter matches actual signer in settle()
**Severity**: Info
**Category**: evm-audit-general
**Location**: `settle()` in X402PaymentVerifier.sol
**Description**: The `settle()` function accepts `from` as a parameter and records it as `payer` in the payment struct. The actual validation that `from` signed the authorization happens inside the token's `transferWithAuthorization`. If the token implementation is correct, a mismatch will revert. However, the verifier itself performs no validation, relying entirely on the external token contract for this critical check. If a non-conforming ERC-3009 token is added as supported, the `from` field in the payment record could be spoofed.
**Proof of Concept**: Owner adds a malicious or buggy token that does not verify signatures in `transferWithAuthorization`. Attacker calls `settle()` with `from = victim` and arbitrary signature. Payment records victim as payer.
**Recommendation**: This is acceptable given the trust model (owner controls which tokens are supported), but document this trust assumption clearly.
