## [ERC20-1] Fee-on-Transfer Token Restriction Is Documentation-Only -- No On-Chain Enforcement
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `proposeToken()`, `activateToken()`, `settle()`
**Description**: The NatSpec states only non-fee-on-transfer tokens should be registered, but `proposeToken()` and `activateToken()` perform no on-chain validation of this property. The balance-before/after pattern in `settle()` correctly stores the actual `received` amount rather than the nominal `value`, so single-payment accounting is accurate. However, when multiple payments are escrowed simultaneously, outgoing transfer fees on `release()` and `releaseTo()` reduce the contract's balance below the sum of remaining escrowed `p.amount` values. The last user to call `release()` faces a revert due to insufficient balance.
**Proof of Concept**: 1. Owner proposes and activates a 1% fee-on-transfer token. 2. Two payers each settle 100 tokens; contract receives 99 each, stores `amount = 99` for both (198 total recorded, 198 held). 3. First `release()` sends 99 tokens but the outgoing fee deducts 0.99 from the contract, leaving 198 - 99 = 99 in the contract. This actually works for simple fee-on-transfer. The real issue: `release()` calls `safeTransfer(recipient, 99)` which only delivers 98.01 to the recipient -- the recipient is silently shortchanged with no on-chain record of the discrepancy. 4. For refund flows, the payer is double-taxed: once on inbound (100 -> 99 received), once on outbound refund (99 -> 98.01 delivered).
**Recommendation**: Add `require(received == value, "X402: fee-on-transfer not supported")` in `settle()` to reject fee-on-transfer tokens at the transaction level. This enforces the documented restriction on-chain.

## [ERC20-2] Rebasing Token Restriction Is Documentation-Only -- Accounting Drift Causes Permanent Fund Lock
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `settle()`, `release()`, `releaseTo()`, `_refundTo()`
**Description**: The NatSpec warns against rebasing tokens, but no on-chain guard prevents the owner from adding one via `proposeToken()`/`activateToken()`. If a rebasing token (e.g., stETH, AMPL) is added, the stored `p.amount` becomes stale as the contract's actual balance changes. A negative rebase makes `release()` revert when it attempts to transfer more tokens than the contract holds. A positive rebase locks excess tokens permanently since there is no sweep function. Since `_refundTo()` requires `block.timestamp < p.releaseAt`, once the escrow expires with a failed `release()`, funds are unrecoverable.
**Proof of Concept**: 1. Owner activates a rebasing token. 2. Payment of 1000 tokens is escrowed. 3. Negative rebase reduces contract balance to 900. 4. `release()` calls `safeTransfer(recipient, 1000)` and reverts. 5. If escrow has expired, `_refundTo()` also reverts. Funds are permanently locked.
**Recommendation**: Add `require(received == value, "X402: non-standard transfer")` in `settle()` (same check as ERC20-1). This rejects rebasing tokens that deliver a different amount than authorized. For positive rebases, add an owner-gated `sweep()` for surplus tokens.

## [ERC20-3] Blocklisted Recipient Causes Permanent Fund Lock -- No Recovery Path Exists
**Severity**: High
**Category**: evm-audit-erc20
**Location**: `release()`, `releaseTo()`, `_refundTo()`
**Description**: USDC and USDT -- the primary tokens with ERC-3009 support -- implement address blocklists. If a recipient's address is added to the token blocklist after settlement but before release, `release()` and `releaseTo()` revert because `safeTransfer` to a blocklisted address fails. The `_refundTo()` path requires `block.timestamp < p.releaseAt`, so once the escrow period ends, it is also unavailable. `releaseTo()` partially mitigates this (recipient can redirect to a non-blocked address), but only if the recipient can still call the function. If the recipient is a contract that is bricked, or if the recipient's EOA private key is lost/inaccessible, no one else can call `releaseTo()` since it requires `msg.sender == p.recipient`. There is no admin rescue function.
**Proof of Concept**: 1. Seller settles 1000 USDC with 24-hour escrow. 2. Circle blocklists the seller's address. 3. After 24 hours, anyone calls `release()` -- reverts on blocklisted transfer. 4. `_refundTo()` reverts because escrow period ended. 5. Seller cannot call `releaseTo()` if their address is a blocklisted contract. 6. Funds permanently locked.
**Recommendation**: Add an owner-gated emergency rescue function callable after a grace period (e.g., 30 days post-`releaseAt`) when both `release()` and `_refundTo()` are impossible. Alternatively, allow the payer to reclaim funds after an extended deadline if the recipient has not released.

## [ERC20-4] Blocklisted Payer Prevents Refund -- Payer Cannot Choose Refund Destination
**Severity**: High
**Category**: evm-audit-erc20
**Location**: `_refundTo()`
**Description**: The `_refundTo()` function is `internal` and only callable by the recipient (`msg.sender == p.recipient`). If the recipient calls it with the original payer's address as `refundRecipient` and that address has been blocklisted, the `safeTransfer` reverts. The payer has no ability to specify an alternative refund address. After the escrow period expires, `_refundTo()` becomes permanently uncallable. The payer is entirely dependent on the recipient to (a) initiate the refund, and (b) choose a non-blocklisted destination, and (c) do so before the escrow window closes.
**Proof of Concept**: 1. Payer settles 1000 USDC. 2. Payer's address is blocklisted by Circle. 3. Recipient attempts `_refundTo(invoiceId, payerAddress)` -- reverts. 4. Escrow period expires. 5. Funds locked or released to recipient, payer gets nothing.
**Recommendation**: Add a public function allowing the payer to register an alternative refund address before the escrow expires. Alternatively, implement a pull-based refund pattern where the refund is credited to an internal balance that the payer can withdraw to any address.

## [ERC20-5] Pausable Token Can Eliminate Refund Window Permanently
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `release()`, `_refundTo()`
**Description**: USDC and USDT have a `pause()` mechanism halting all transfers. If the token is paused during the escrow window, `_refundTo()` reverts. Once the escrow expires, the refund path is permanently closed (`require(block.timestamp < p.releaseAt)` fails). When the token unpauses, only `release()` and `releaseTo()` remain available. There is no mechanism to extend the escrow deadline or retry a failed refund after unpause.
**Proof of Concept**: 1. Payment settled with 24-hour escrow. 2. At hour 20, recipient wants to refund. Token is paused. 3. Token unpauses at hour 30. 4. `_refundTo()` now fails with "escrow period ended." 5. Payer loses refund opportunity through no fault of their own.
**Recommendation**: Allow the recipient to mark a payment as "refund-pending" during escrow (even if the actual transfer fails), which would preserve the refund right after unpause. Alternatively, extend the escrow deadline automatically when a transfer reverts.

## [ERC20-6] release() Lacks Access Control -- Front-Runner Can Force Transfer to Blocklisted Address
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `release()`
**Description**: Unlike `releaseTo()` which requires `msg.sender == p.recipient`, `release()` has no access control. Anyone can call it after the escrow period. If a recipient intends to use `releaseTo()` to redirect funds to a safe address (e.g., because their original address is about to be blocklisted), a front-runner can call `release()` first, sending funds to the original address. If the blocklist is applied in the same block or shortly after, the funds arrive at an address that immediately becomes frozen.
**Proof of Concept**: 1. Recipient knows their address will be blocklisted. 2. Recipient submits `releaseTo(invoiceId, safeAddress)`. 3. MEV bot front-runs with `release(invoiceId)`, sending funds to original address. 4. Blocklist applied, recipient cannot move the funds.
**Recommendation**: Add `require(msg.sender == p.recipient || msg.sender == p.payer, "X402: unauthorized")` to `release()`.

## [ERC20-7] Owner Can Add Malicious Token via proposeToken -- 48-Hour Timelock Is Only Mitigation
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `proposeToken()`, `activateToken()`
**Description**: The owner can propose any contract as a supported token, subject only to a 48-hour timelock and `code.length > 0`. A malicious token could implement `receiveWithAuthorization()` to always succeed while `balanceOf()` returns manipulated values, inflating the `received` amount recorded in `settle()`. When `release()` calls `safeTransfer()` with the inflated amount, the malicious token's `transfer()` could interact with the contract in unintended ways. The `Ownable2Step` pattern mitigates accidental ownership transfer, and the 48-hour delay provides a detection window, but there is no automated defense or governance requirement.
**Proof of Concept**: 1. Compromised owner proposes malicious token. 2. After 48 hours, activates it. 3. Attacker settles with manipulated `balanceOf` returning inflated values. 4. `received` is inflated, `p.amount` stores an amount the contract does not actually hold. 5. Subsequent operations on legitimate tokens are unaffected (separate balances), but the malicious token's `release()` calls execute arbitrary logic.
**Recommendation**: Require multi-sig or governance approval for token activation. Emit events on `proposeToken()` for monitoring. Consider requiring the token to conform to a known interface beyond just code existence (e.g., verify `decimals()` returns a sane value, or verify it is listed in a trusted registry).

## [ERC20-8] ERC-777 Restriction Is Documentation-Only -- ReentrancyGuard Provides Adequate Mitigation
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `settle()`, `release()`, `releaseTo()`, `_refundTo()`
**Description**: The NatSpec states ERC-777 tokens are unsupported, but no on-chain check prevents their addition. An ERC-777 token passes the `code.length > 0` check in `proposeToken()`. If added, the `tokensReceived` hook on outgoing transfers could enable reentrancy. However, `settle()`, `release()`, and `releaseTo()` all use `nonReentrant`. The `_refundTo()` function is `internal` and inherits the caller's `nonReentrant` guard. Additionally, all state updates (`p.released = true`, `p.refunded = true`) occur before the external `safeTransfer` call, following checks-effects-interactions. Both mitigations are present and sufficient.
**Proof of Concept**: Theoretical only -- requires owner to add an ERC-777 token in violation of documented assumptions. Even then, reentrancy is blocked by `nonReentrant` and CEI ordering.
**Recommendation**: No code change required. The existing `ReentrancyGuard` and CEI pattern provide adequate defense. For belt-and-suspenders, consider checking the ERC-1820 registry in `proposeToken()` to reject ERC-777 tokens.

## [ERC20-9] Directly Transferred Tokens Are Permanently Locked -- No Sweep Function
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: Contract-wide
**Description**: Tokens sent directly to the contract via `transfer()` (outside the `settle()` flow) are permanently locked. There is no `sweep()` or emergency withdrawal function. The balance-before/after pattern in `settle()` is not vulnerable to manipulation by direct transfers (it correctly snapshots before and after the `receiveWithAuthorization` call), but the directly sent tokens are simply lost. This also applies to tokens from removed/desupported token contracts.
**Proof of Concept**: 1. User accidentally sends 100 USDC directly to the contract. 2. No function exists to recover them. 3. Tokens are permanently locked.
**Recommendation**: Add an owner-gated `sweep()` that can recover tokens not accounted for in active escrows. Track total escrowed amount per token and only allow sweeping the excess.

## [ERC20-10] No SafeERC20 Wrapper for receiveWithAuthorization -- Mitigated by Balance Check
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: The `receiveWithAuthorization()` call uses the raw `IERC3009` interface without `SafeERC20` wrapping. If a non-standard implementation returns `false` instead of reverting on failure, the call would not be detected as failed. However, the subsequent `require(received > 0)` check via the balance-before/after pattern catches any scenario where no tokens were actually transferred. This is defense-in-depth and sufficient.
**Proof of Concept**: N/A -- the balance check catches all failure modes.
**Recommendation**: No change needed. Document why `SafeERC20` is not used for this call (ERC-3009 is outside the SafeERC20 wrapper scope).

## [ERC20-11] Missing Return Value Tokens Handled Correctly via SafeERC20
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `release()`, `releaseTo()`, `_refundTo()`
**Description**: Some tokens (notably USDT on Ethereum) do not return a boolean from `transfer()`. The contract correctly uses `SafeERC20.safeTransfer()` for all outgoing transfers, which handles missing/non-standard return values. This is correctly implemented.
**Proof of Concept**: N/A -- correctly mitigated.
**Recommendation**: No action needed.

## [ERC20-12] ERC-3009 Limits Settlement to EOA Wallets Only
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `settle()`, `IERC3009` interface
**Description**: The `IERC3009` interface accepts only ECDSA signatures `(v, r, s)`. Smart contract wallets (Gnosis Safe, ERC-4337 accounts) cannot produce ECDSA signatures and therefore cannot authorize payments. This is a limitation of the ERC-3009 standard, not a bug in this contract, but it restricts the payer base to EOAs only.
**Proof of Concept**: A user with a smart contract wallet cannot sign an ERC-3009 authorization.
**Recommendation**: Document this limitation. Consider adding an alternative settlement path via ERC-2612 `permit()` + `transferFrom()` for smart contract wallet support.

## [ERC20-13] Conflux eSpace Token Compatibility -- Bridged USDC May Lack ERC-3009 Support
**Severity**: Medium
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: On Conflux eSpace, USDC is typically a bridged wrapper token rather than a native Circle issuance. Bridged tokens generally do not implement ERC-3009 (`receiveWithAuthorization`), making the entire `settle()` flow non-functional for the most common stablecoin on the chain. If the token is added via `proposeToken()` and passes validation (it has code, it is not zero address), but does not implement `receiveWithAuthorization`, all `settle()` calls will revert at the `IERC3009` call. The contract would be deployed and configured but functionally useless for that token.
**Proof of Concept**: 1. Owner deploys contract on Conflux eSpace with bridged USDC address. 2. User attempts to settle -- `receiveWithAuthorization` does not exist on the bridged USDC contract. 3. Call reverts. 4. Contract is non-functional for its primary intended token.
**Recommendation**: Before adding any token on Conflux eSpace, verify it implements ERC-3009 by calling `receiveWithAuthorization` on a testnet. Consider adding an `IERC3009` support check in `proposeToken()` (e.g., ERC-165 `supportsInterface` if the token implements it, or a try/catch static call). Add an alternative settlement path using standard `transferFrom()` for tokens that lack ERC-3009.

## [ERC20-14] Duplicate Token Addresses in Constructor Silently Accepted
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `constructor()`
**Description**: The constructor iterates over `_tokens` and sets `supportedTokens[token] = true` for each. Duplicate addresses are silently accepted -- the mapping is simply written twice. No event is emitted (in the visible code), so this has no security impact but could confuse deployment verification.
**Proof of Concept**: Deploy with `_tokens = [USDC, USDC]`. No revert, USDC is supported (idempotent).
**Recommendation**: Add `require(!supportedTokens[_tokens[i]], "X402: duplicate token")` in the constructor loop.

## [ERC20-15] Token Removal Does Not Affect In-Flight Escrowed Payments
**Severity**: Low
**Category**: evm-audit-erc20
**Location**: `removeToken()`, `release()`, `releaseTo()`
**Description**: When the owner calls `removeToken()`, existing escrowed payments using that token remain releasable and refundable because `release()`, `releaseTo()`, and `_refundTo()` do not check `supportedTokens[p.token]`. This is correct behavior for user fund safety (removal should block new settlements, not lock existing funds). However, if a token is removed because it is discovered to be malicious, in-flight escrowed payments will still execute `safeTransfer` on the malicious contract.
**Proof of Concept**: 1. Owner removes a token discovered to be malicious. 2. `release()` on an existing payment still calls `safeTransfer` on the malicious token.
**Recommendation**: Consider adding an emergency freeze mechanism for specific tokens that blocks all operations including release. This trades user fund availability for safety and should require a timelock or multi-sig.

## [ERC20-16] No Maximum Payment Amount -- Single Authorization Can Drain Entire Payer Balance
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: There is no upper bound on `value` in `settle()`. While `receiveWithAuthorization` enforces the payer's actual balance and the authorization signature covers the exact amount, there is no per-payment or per-seller cap. A compromised authorization signature for a large amount can drain the payer's full token balance in one transaction. This is standard ERC-3009 behavior.
**Proof of Concept**: N/A -- design observation.
**Recommendation**: Consider optional per-seller payment limits configurable during seller registration.

## [ERC20-17] Approval Race Condition Not Applicable -- Contract Uses ERC-3009 Nonces
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: The contract does not use ERC-20 `approve()`/`transferFrom()`, so the classic approval race condition does not apply. ERC-3009 authorizations are nonce-based and single-use. The contract tracks used nonces via `usedNonces[keccak256(abi.encode(from, nonce))]` providing an early cheap revert before the more expensive on-chain ERC-3009 nonce check. No issue.
**Proof of Concept**: N/A.
**Recommendation**: No action needed.

## [ERC20-18] Tokens Reverting on Zero-Amount Transfer Are Handled
**Severity**: Info
**Category**: evm-audit-erc20
**Location**: `settle()`
**Description**: Some tokens (e.g., LEND) revert on zero-amount transfers. The `require(value > 0, "X402: zero payment")` check in `settle()` prevents zero-amount authorizations from reaching the `receiveWithAuthorization` call. The `require(received > 0)` check provides a secondary guard. No issue.
**Proof of Concept**: N/A -- correctly handled.
**Recommendation**: No action needed.
