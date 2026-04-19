# DOS & Griefing Audit Findings — X402PaymentVerifier.sol

**Auditor**: Claude Opus 4.6
**Date**: 2026-04-02
**Contract**: `X402PaymentVerifier.sol`
**Scope**: Denial-of-Service and Griefing attack vectors

---

## [DOS-1] Returndata bombing via `receiveWithAuthorization` external call

**Severity**: Low
**Category**: evm-audit-dos
**Location**: `settle()` (line 324)
**Description**: The `receiveWithAuthorization` call at line 324 is made to an arbitrary token address (constrained only to `supportedTokens`). If a malicious or compromised token is added via the timelock, the token contract could return an arbitrarily large returndata payload. Solidity copies all returndata into memory, and memory expansion costs grow quadratically. A token returning megabytes of data could force the caller to pay enormous gas or cause the transaction to revert due to gas exhaustion.

The same risk applies to the `balanceOf` calls on lines 323 and 333, and to `safeTransfer` calls in `release()`, `releaseTo()`, and `_refundTo()`.

However, the practical risk is mitigated by the 48-hour timelock on token additions and the fact that the owner controls which tokens are supported. Only genuinely malicious or compromised token contracts would exhibit this behavior.

**Proof of Concept**:
1. Owner (or compromised owner key) proposes a malicious token via `proposeToken()`.
2. After 48 hours, owner activates it via `activateToken()`.
3. A seller registers and a buyer creates an authorization for this token.
4. The seller calls `settle()`. The malicious token's `receiveWithAuthorization` returns 1MB+ of data.
5. Memory expansion costs cause the transaction to consume all available gas and revert.

**Recommendation**: Use low-level `call` with a bounded returndata copy for the `receiveWithAuthorization` interaction, or use assembly to limit returndata size. For `balanceOf`, consider using a static call wrapper that caps returndata to 32 bytes. In practice, the timelock already provides a window for users to react to suspicious token additions, making this low severity.

```solidity
// Example: cap returndata for balanceOf
function _safeBalanceOf(address token) internal view returns (uint256) {
    (bool success, bytes memory data) = token.staticcall(
        abi.encodeCall(IERC20.balanceOf, (address(this)))
    );
    require(success && data.length == 32, "X402: balanceOf failed");
    return abi.decode(data, (uint256));
}
```

---

## [DOS-2] Unbounded `sellerList` growth on Conflux eSpace (L2 with cheap gas)

**Severity**: Medium
**Category**: evm-audit-dos
**Location**: `registerSeller()` (line 186), `reactivateSeller()` (line 209), `getActiveSellers()` (line 540)
**Description**: Conflux eSpace is an EVM-compatible layer with significantly cheaper gas than Ethereum mainnet. The `sellerList` array grows by one entry per `registerSeller()` or `reactivateSeller()` call. Although `getActiveSellers()` uses pagination (offset/limit), the `sellerList` array itself has no cap on length.

More critically, the `reactivateSeller()` function pushes a new entry to `sellerList` every time a seller reactivates after deactivation. A single address can cycle through `deactivateSeller()` -> `reactivateSeller()` repeatedly, growing `sellerList` without bound. Each cycle only costs `registrationFee` in CFX. If `registrationFee` is set to 0 (which is the default), this is completely free.

While `getActiveSellers()` is paginated and safe, any off-chain system that calls `getSellerCount()` and attempts to enumerate all sellers in a single RPC call (e.g., `getActiveSellers(0, sellerList.length)`) could be DoS'd by a bloated array.

**Proof of Concept**:
1. `registrationFee` is 0 (the default).
2. Attacker calls `registerSeller(...)` once.
3. Attacker loops: `deactivateSeller(self)` then `reactivateSeller(...)` — 100,000 times.
4. `sellerList.length` is now 100,001 (only 1 active, but the array is huge).
5. Wait — actually, `deactivateSeller` uses swap-and-pop so the array shrinks. But each `reactivateSeller` pushes again. The net effect after N cycles is `sellerList.length == 1` (since deactivate pops, reactivate pushes). So the array stays bounded at 1 for a single attacker cycling.

However, with many distinct addresses (cheap to create on Conflux), an attacker can register thousands of sellers at zero cost if `registrationFee == 0`. Each unique address adds a permanent entry (they never deactivate).

**Proof of Concept (revised)**:
1. `registrationFee` is 0.
2. Attacker deploys a factory contract that creates 10,000 minimal proxy contracts.
3. Each proxy calls `registerSeller(...)` — all free.
4. `sellerList.length` is now 10,000+.
5. Off-chain consumers that naively fetch all sellers face degraded performance.

**Recommendation**: Set a meaningful minimum `registrationFee` that cannot be zero, or add an upper bound on `sellerList.length`. A non-zero fee makes mass registration economically infeasible.

```solidity
uint256 public constant MIN_REGISTRATION_FEE = 0.01 ether; // e.g., 0.01 CFX

function setRegistrationFee(uint256 fee) external onlyOwner {
    require(fee >= MIN_REGISTRATION_FEE, "X402: fee below minimum");
    registrationFee = fee;
    emit RegistrationFeeUpdated(fee);
}
```

---

## [DOS-3] Token transfer to blocklisted address blocks `release()` and `refund()`

**Severity**: Medium
**Category**: evm-audit-dos
**Location**: `release()` (line 375), `_refundTo()` (line 462)
**Description**: Stablecoins like USDC and USDT implement address blocklists. If a seller's address (the `recipient`) is blocklisted after a payment is settled but before `release()` is called, the `safeTransfer` on line 375 will revert, permanently locking the escrowed funds.

The contract does provide `releaseTo()` (line 384) which allows the seller to redirect funds to an alternative address, mitigating the seller-blocklist scenario. However, if the **payer** is blocklisted after settlement, `refund()` and `refundTo()` will both revert because `refundTo()` enforces `refundRecipient == payments[invoiceId].payer` (line 443). There is no mechanism for the payer to redirect their refund to an alternative address, and no admin override.

This means: if a payer gets blocklisted by the token issuer during the escrow period, the seller cannot refund them. The seller must then wait for escrow to expire and call `release()` to claim the funds — but if the seller is also honest and wants to refund, the funds are stuck until escrow expires.

**Proof of Concept**:
1. Buyer pays seller 1000 USDC via `settle()`. Escrow is 24 hours.
2. During the 24-hour escrow, the buyer's address is added to USDC's blocklist (e.g., OFAC sanction).
3. Seller calls `refund(invoiceId)` — reverts because `safeTransfer` to the blocklisted payer fails.
4. Seller calls `refundTo(invoiceId, alternativeAddr)` — reverts because `refundRecipient != payer`.
5. Funds remain locked in escrow until `releaseAt`, then can only go to the seller.

**Recommendation**: Allow the payer to register an alternative refund address, or allow the seller to refund to an arbitrary address (with payer consent via signature), or add an admin emergency refund function.

```solidity
// Option: mapping for payer-designated alternative refund address
mapping(address => address) public alternativeRefundAddress;

function setAlternativeRefundAddress(address alt) external {
    require(alt != address(0), "X402: zero address");
    alternativeRefundAddress[msg.sender] = alt;
}

// In _refundTo, fall back to alternative address:
// address target = alternativeRefundAddress[p.payer] != address(0)
//     ? alternativeRefundAddress[p.payer]
//     : p.payer;
```

---

## [DOS-4] Revert-based DoS on `withdrawFees()` via reverting owner fallback

**Severity**: Low
**Category**: evm-audit-dos
**Location**: `withdrawFees()` (line 516)
**Description**: The `withdrawFees()` function sends the entire contract's native CFX balance to `owner()` via a low-level `.call{value:}`. If the owner is a smart contract (e.g., a multisig or governance contract) whose `receive()` or `fallback()` function reverts, registration fees become permanently locked.

Since the contract uses `Ownable2Step`, ownership transfer requires the new owner to call `acceptOwnership()`, so the new owner must be a callable address. However, a multisig could accept ownership and then have its fallback disabled or upgraded to always revert.

The severity is Low because: (a) ownership is controlled and deliberate, (b) collected fees are not user funds, and (c) the owner can transfer ownership to a non-reverting address to recover.

**Proof of Concept**:
1. Ownership is transferred to a multisig contract.
2. The multisig's fallback/receive is later upgraded to revert (or a bug is introduced).
3. `withdrawFees()` always reverts — registration fees are stuck.

**Recommendation**: Add a `withdrawFeesTo(address payable to)` function that allows the owner to specify the recipient, avoiding dependence on the owner address being able to receive ETH/CFX.

```solidity
function withdrawFeesTo(address payable to) external onlyOwner {
    require(to != address(0), "X402: zero address");
    uint256 balance = address(this).balance;
    require(balance > 0, "X402: no fees to withdraw");
    (bool sent, ) = to.call{value: balance}("");
    require(sent, "X402: fee withdrawal failed");
}
```

---

## [DOS-5] Timelock-based griefing: token proposal can be cancelled at no cost

**Severity**: Low
**Category**: evm-audit-dos
**Location**: `proposeToken()` (line 473), `removeToken()` (line 495)
**Description**: The owner can propose a token with a 48-hour timelock via `proposeToken()`, but can also instantly cancel it via `removeToken()` which deletes `pendingTokenActivation[token]`. A compromised or malicious owner key can grief users by repeatedly proposing and cancelling token additions, preventing any new token from ever being activated while appearing to act in good faith.

This is an owner-trust issue and inherent to the admin key model. The severity is Low because the owner is already a trusted role with significant power (can remove existing tokens, set fees to max, etc.).

**Proof of Concept**:
1. Community requests adding Token X.
2. Owner calls `proposeToken(tokenX)` — 48 hour timelock starts.
3. At hour 47, owner calls `removeToken(tokenX)` — cancels the pending activation.
4. Owner repeats, indefinitely delaying the activation with no on-chain cost beyond gas.

**Recommendation**: Consider separating the cancel/remove role from the propose role, or adding a minimum time before a pending proposal can be cancelled. Alternatively, document this as accepted admin trust assumption.

---

## [DOS-6] `settle()` external call to `receiveWithAuthorization` with insufficient gas forwarding

**Severity**: Low
**Category**: evm-audit-dos
**Location**: `settle()` (line 324)
**Description**: The `receiveWithAuthorization` call on line 324 forwards all available gas (Solidity default for external calls). This is actually the correct behavior and avoids SWC-126. However, the function performs significant operations after the external call (a second `balanceOf` call, storage writes for the `Payment` struct, and event emission). If a caller provides just barely enough gas, the external call could succeed but the remaining operations could fail.

This is not a true vulnerability because: the transaction would simply revert atomically, and the caller (the seller) controls the gas they provide. A seller has no incentive to provide insufficient gas to their own settlement call.

This item is informational only — the contract correctly forwards all gas and does not use hardcoded gas stipends.

**Proof of Concept**: N/A — not exploitable in practice.

**Recommendation**: No action needed. The current behavior of forwarding all available gas is correct.
