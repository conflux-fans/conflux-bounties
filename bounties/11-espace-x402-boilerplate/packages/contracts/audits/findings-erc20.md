# ERC20 Token Security Audit Findings

**Contract**: `X402PaymentVerifier.sol`
**Auditor**: Claude Opus 4.6
**Date**: 2026-04-02
**Scope**: ERC20 token interaction security checklist

---

## [ERC20-1] Tokens with blocklists can permanently lock escrowed funds
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `release()`, `releaseTo()`, `_refundTo()`
**Description**: USDC and USDT (both listed as intended supported tokens) maintain blocklists that can freeze addresses at any time. If a payer or seller address is blocklisted after a payment is settled into escrow, `safeTransfer` will revert, permanently locking the escrowed funds in the contract. The `releaseTo()` function partially mitigates this for sellers (they can redirect release to an alternative address), but there is no equivalent escape hatch for refunds -- `refundTo()` enforces `refundRecipient == payments[invoiceId].payer`, so if the payer is blocklisted, the refund is permanently stuck. Additionally, if the seller is blocklisted, they cannot call `releaseTo()` themselves (since `msg.sender == p.recipient` is required), and the permissionless `release()` will also revert because it sends to the blocklisted `p.recipient`.
**Proof of Concept**:
1. Buyer pays 1000 USDC via `settle()`. Funds held in escrow.
2. USDC blocklists the buyer's address during the escrow period.
3. Seller calls `refund(invoiceId)` -- reverts because `safeTransfer` to the blocklisted buyer fails.
4. `refundTo()` also reverts because it enforces `refundRecipient == p.payer`.
5. After escrow expires, `release()` succeeds (sends to seller), but refund path is permanently broken.

Alternative scenario for seller blocklisting:
1. Buyer pays. Seller gets blocklisted.
2. `release()` reverts (sends to blocklisted `p.recipient`).
3. `releaseTo()` requires `msg.sender == p.recipient` -- the blocklisted seller may still be able to call this if blocklisting only affects token transfers (not arbitrary calls). This is the intended mitigation, but it depends on the blocklist implementation.
4. If the seller loses access to their key entirely, funds are locked forever since there is no owner/admin rescue path.

**Recommendation**: Add an admin emergency release function gated by a timelock (e.g., 90 days after `releaseAt`) that can redirect stuck funds. For refunds, allow the seller to specify an alternative refund address that the payer has pre-approved (or allow the contract owner to intervene after a long delay).

```solidity
// Example: admin rescue for stuck escrows after extended timeout
function emergencyRescue(bytes32 invoiceId, address to) external onlyOwner {
    Payment storage p = payments[invoiceId];
    require(p.paidAt > 0 && !p.released && !p.refunded, "X402: invalid state");
    require(block.timestamp >= p.releaseAt + 90 days, "X402: rescue too early");
    require(to != address(0), "X402: zero address");
    p.released = true;
    IERC20(p.token).safeTransfer(to, p.amount);
}
```

---

## [ERC20-2] Zero-escrow sellers bypass refund protection entirely
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()`, `_refundTo()` line 452
**Description**: Sellers can register with `escrowDuration = 0`, which sets `releaseAt = block.timestamp` (same block as payment). The refund function requires `block.timestamp < p.releaseAt`, which will be false in the same block (or any subsequent block). This means refunds are impossible for zero-escrow sellers. While this is documented behavior ("0 = immediate release, no escrow"), it interacts poorly with tokens that have transfer pausing -- if a token pauses transfers right after settlement and before `release()` is called in the same transaction flow, the funds get stuck with no refund option.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 0`.
2. Buyer pays via `settle()`. `releaseAt = block.timestamp`.
3. Seller realizes they need to refund (wrong amount, wrong buyer, etc.).
4. `refund()` reverts with "X402: escrow period ended" because `block.timestamp >= p.releaseAt`.
5. The only option is `release()`, which sends funds to the seller -- no refund possible.
**Recommendation**: This is a design choice, but buyers interacting with zero-escrow sellers should be warned in the frontend/documentation that refunds are not possible. Consider enforcing a minimum escrow of at least 1 block or a short period (e.g., 1 hour) to allow for error correction.

---

## [ERC20-3] USDT approve race condition is not applicable but SafeERC20 usage should be verified for all transfer paths
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `settle()` line 324
**Description**: The contract correctly avoids `transferFrom` (and thus the USDT approve race condition) by using ERC-3009 `receiveWithAuthorization` for inbound transfers and `safeTransfer` (not `safeTransferFrom`) for outbound transfers. OpenZeppelin's `SafeERC20` handles USDT's missing return value on `transfer()`. This is well-designed. However, the `IERC3009.receiveWithAuthorization` call on line 324 does NOT use SafeERC20 -- it calls the token directly via the IERC3009 interface. If the ERC-3009 implementation has a non-standard return value or reverts silently, the balance-check pattern (lines 323-334) correctly catches this. The balance-before/after pattern is the right approach here.
**Proof of Concept**: N/A -- informational confirmation of correct design.
**Recommendation**: No action needed. The balance-check pattern at lines 323-334 is the correct mitigation for non-standard token behavior during `receiveWithAuthorization`.

---

## [ERC20-4] Decimals variation across chains can cause payment amount mismatches
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `settle()`, `verifyPayment()`
**Description**: USDC has 6 decimals on Ethereum/most L2s but could have different decimals on other chains. USDT0 (a listed supported token) may have different decimal configurations on Conflux eSpace vs other chains. The contract stores `amount` as raw token units with no decimal normalization. If the same off-chain x402 payment protocol is used across multiple chains, a payment request for "10 USDC" could mean `10e6` on one chain and `10e18` on another, leading to massive over/underpayment. The `verifyPayment` function compares raw amounts, so the caller must know the correct decimals for the chain.
**Proof of Concept**:
1. Off-chain x402 protocol specifies payment of "100 USDC" for an API call.
2. On Ethereum (6 decimals), this is `100_000_000` (100e6).
3. If the same protocol message is replayed on a chain where the USDC-equivalent token has 18 decimals, the buyer signs for `100_000_000` which is only `0.0000000001` tokens.
4. `verifyPayment` passes because the raw amount matches, but the economic value is negligible.
**Recommendation**: Document the expected decimals for each supported token on Conflux eSpace. The off-chain x402 protocol layer should include the chain ID and token address in the payment request to prevent cross-chain confusion. Consider adding a `decimals` field to the supported tokens mapping for on-chain verification.

---

## [ERC20-5] No validation that the token still has code at settlement time
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()` line 299
**Description**: The constructor and `proposeToken` verify `token.code.length > 0`, but `settle()` only checks `supportedTokens[token]`. If a token contract self-destructs (rare but possible, especially with proxy patterns or `SELFDESTRUCT`), subsequent calls to `IERC3009.receiveWithAuthorization` would succeed silently (returning zero to a non-existent contract on some EVM implementations), and `IERC20.balanceOf` would return 0, causing the `received > 0` check to fail. However, with the Solmate `SafeTransferLib` concern from the checklist -- OpenZeppelin's `SafeERC20` DOES check for contract existence (unlike Solmate), so `safeTransfer` in `release()`/`refund()` would revert if the token self-destructs after settlement. This is handled correctly.
**Proof of Concept**: N/A -- the `received > 0` check in settle and OpenZeppelin's SafeERC20 both protect against this.
**Recommendation**: No immediate action needed. The existing checks are sufficient. Note that `SELFDESTRUCT` is deprecated in post-Dencun Ethereum, and Conflux eSpace may follow suit.

---

## [ERC20-6] ERC-3009 assumption limits token compatibility and creates a fragile trust boundary
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: Contract-wide, `supportedTokens` mapping
**Description**: The contract requires all tokens to support ERC-3009 (`receiveWithAuthorization`). This standard is only implemented by Circle-family tokens (USDC, EURC), Tether's USDT0, and a few others. The admin `proposeToken`/`activateToken` flow only checks that the address has code and is not already supported -- it does NOT verify that the token actually implements ERC-3009. If an admin mistakenly adds a standard ERC-20 token without ERC-3009 support, `settle()` will revert on `receiveWithAuthorization`, but the token will appear as "supported" in the `supportedTokens` mapping, confusing integrators and UIs. More critically, the "non-fee-on-transfer, non-rebasing" assumption is enforced only by admin discipline and NatSpec documentation -- there is no on-chain enforcement.
**Proof of Concept**:
1. Owner calls `proposeToken(DAI_ADDRESS)` -- DAI does not implement ERC-3009.
2. After 48 hours, owner calls `activateToken(DAI_ADDRESS)`.
3. `supportedTokens[DAI]` is now `true`.
4. Frontend shows DAI as supported. Users attempt payments that always revert.
5. Alternatively: owner adds a fee-on-transfer token. `settle()` succeeds but `received < value`. The escrowed `received` amount is correct (balance-check catches this), but the payer paid more than `received` in fees -- the payment amount recorded is less than what was debited from the payer.
**Recommendation**: Add an interface check in `proposeToken` using ERC-165 if the token supports it, or attempt a static call to verify the function selector exists:

```solidity
function proposeToken(address token) external onlyOwner {
    require(token != address(0), "X402: zero token address");
    require(token.code.length > 0, "X402: token has no code");
    require(!supportedTokens[token], "X402: already supported");

    // Verify ERC-3009 interface exists (best-effort check)
    (bool success, ) = token.staticcall(
        abi.encodeWithSelector(IERC3009.authorizationState.selector, address(0), bytes32(0))
    );
    require(success, "X402: token lacks ERC-3009");

    pendingTokenActivation[token] = block.timestamp + TOKEN_ACTIVATION_DELAY;
    emit TokenProposed(token, pendingTokenActivation[token]);
}
```

---

## [ERC20-7] Permit front-running griefing is not applicable but ERC-3009 nonce front-running has a similar vector
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()` line 324
**Description**: The contract uses `receiveWithAuthorization` (not `transferWithAuthorization`), which inherently prevents front-running because the `to` parameter is verified by the token contract -- only the designated `to` address can execute the authorization. However, there is a subtle griefing vector: if the ERC-3009 token also exposes `transferWithAuthorization` (which most do), an attacker who obtains the signed authorization could call `transferWithAuthorization` directly on the token contract BEFORE the seller calls `settle()`. This would use the nonce, causing `receiveWithAuthorization` in `settle()` to revert. The funds would go to this contract (since `to = address(this)`), but they would NOT be tracked in the `payments` mapping -- effectively locking them in the contract with no recovery path.

Actually, re-examining: `transferWithAuthorization` requires `to` to match the signature, and the signature has `to = address(this_contract)`. So the attacker would need to call `transferWithAuthorization` with the correct `to = contract_address`. The tokens arrive at the contract but bypass `settle()`, so they are untracked and stuck.

**Proof of Concept**:
1. Buyer signs `receiveWithAuthorization` with `to = X402PaymentVerifier`.
2. Attacker monitors the mempool, extracts the signature parameters.
3. Attacker calls `IERC3009(token).transferWithAuthorization(from, contract, value, validAfter, validBefore, nonce, v, r, s)` directly on the token.
4. Tokens arrive at the contract, nonce is consumed.
5. Seller calls `settle()` -- `receiveWithAuthorization` reverts because nonce is already used.
6. Tokens are in the contract but not in any `Payment` record. No recovery mechanism exists.
**Recommendation**: Add an admin function to rescue untracked tokens (tokens held by the contract that exceed the sum of all active escrows). Alternatively, rely on the fact that Conflux eSpace may not have a public mempool, reducing front-running risk. Document this assumption.

```solidity
/// @notice Rescue tokens sent to contract outside of settle() flow
function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
    require(to != address(0), "X402: zero address");
    // Only allow rescuing excess tokens not in active escrows
    // (tracking total escrowed per token would be needed for a safe implementation)
    IERC20(token).safeTransfer(to, amount);
}
```

Note: A proper implementation should track total escrowed balance per token and only allow rescuing the excess.

---

## [ERC20-8] Token upgradeability can break ERC-3009 assumptions
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: Contract-wide
**Description**: USDT is upgradeable on Polygon, and USDC is upgradeable on most chains (it uses a proxy pattern). On Conflux eSpace, supported tokens like USDT0 or USDC may also be deployed behind upgradeable proxies. A token upgrade could: (a) change the ERC-3009 `DOMAIN_SEPARATOR`, invalidating pending authorizations, (b) add fee-on-transfer mechanics, breaking the contract's core assumption, (c) add blocklist entries retroactively affecting escrowed funds, or (d) remove ERC-3009 support entirely.
**Proof of Concept**:
1. Buyer signs an authorization with the current `DOMAIN_SEPARATOR`.
2. Token is upgraded, changing the `DOMAIN_SEPARATOR`.
3. Seller calls `settle()` -- `receiveWithAuthorization` reverts because signature verification fails against the new domain separator.
4. The buyer's funds are safe (authorization fails), but the payment flow is broken.
**Recommendation**: The 48-hour timelock on `proposeToken`/`activateToken` provides some protection for new additions. Consider monitoring supported tokens for upgrades and having an incident response plan. The `removeToken` function allows quick deactivation. Document that token upgrades are an accepted external dependency risk.

---

*End of ERC20 Token Security Audit Findings*

**Summary**:
| ID | Title | Severity |
|----|-------|----------|
| ERC20-1 | Blocklisted addresses can lock escrowed funds | Medium |
| ERC20-2 | Zero-escrow sellers bypass refund protection | Low |
| ERC20-3 | SafeERC20 usage verified (informational) | Info |
| ERC20-4 | Decimals variation across chains | Medium |
| ERC20-5 | Contract existence check at settlement | Low |
| ERC20-6 | ERC-3009 assumption not enforced on-chain | Medium |
| ERC20-7 | ERC-3009 nonce front-running can strand tokens | Low |
| ERC20-8 | Token upgradeability can break assumptions | Low |
