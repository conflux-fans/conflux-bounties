# DoS Findings -- X402PaymentVerifier.sol

## [DOS-1] Unbounded `sellerList` array causes DoS in `getActiveSellers()`
**Severity**: High
**Category**: evm-audit-dos
**Location**: `getActiveSellers()`, `registerSeller()`
**Description**: The `sellerList` array grows without bound as new sellers register via `registerSeller()`. The `getActiveSellers()` function iterates over the entire array twice -- once to count active sellers and once to populate the result. Since `deactivateSeller()` only flips a boolean flag but never removes the address from `sellerList`, the array grows monotonically. Once the array is large enough, `getActiveSellers()` will exceed the block gas limit and become permanently uncallable. Any on-chain consumer (other contracts) that depends on this view function will also be bricked.
**Proof of Concept**:
1. An attacker calls `registerSeller()` repeatedly from different addresses (cheap on L2s like Conflux eSpace where gas costs are minimal).
2. After enough registrations (tens of thousands), `getActiveSellers()` exceeds the block gas limit.
3. Any contract or off-chain integration that calls `getActiveSellers()` to enumerate sellers is permanently DoS'd.
**Recommendation**: Implement pagination for seller enumeration and/or cap the maximum number of sellers. Remove deactivated sellers from `sellerList` by swapping with the last element and popping.
```solidity
// Pagination approach
function getActiveSellers(uint256 offset, uint256 limit) external view returns (Seller[] memory) {
    // iterate from offset, return at most limit results
}

// Or remove from array on deactivation
function deactivateSeller(address wallet) external {
    require(msg.sender == wallet || msg.sender == owner(), "X402: not authorized");
    require(sellers[wallet].active, "X402: not active");
    sellers[wallet].active = false;
    // Find and remove from sellerList via swap-and-pop
    for (uint256 i = 0; i < sellerList.length; i++) {
        if (sellerList[i] == wallet) {
            sellerList[i] = sellerList[sellerList.length - 1];
            sellerList.pop();
            break;
        }
    }
}
```

## [DOS-2] L2 low gas costs make `sellerList` array-filling attack economically viable
**Severity**: High
**Category**: evm-audit-dos
**Location**: `registerSeller()`
**Description**: On L2 chains (including Conflux eSpace), gas costs are orders of magnitude cheaper than Ethereum mainnet. `registerSeller()` has no registration fee, no allowlist, and no cap on the number of sellers. An attacker can register tens or hundreds of thousands of sellers for a trivial cost, inflating `sellerList` to a size that makes `getActiveSellers()` permanently unusable. The only requirement is a unique `msg.sender` per registration, which is trivially achieved with CREATE2 or a factory contract.
**Proof of Concept**:
1. Deploy a factory contract that deploys minimal proxy contracts in a loop.
2. Each proxy calls `registerSeller("http://x", "x")`.
3. At ~50k gas per registration and L2 gas prices of ~1 gwei, filling 100,000 entries costs approximately 0.005 CFX -- negligible.
4. `getActiveSellers()` now iterates 100,000+ entries and reverts with out-of-gas.
**Recommendation**: Add a registration fee that makes mass registration economically infeasible, and/or add an owner-controlled allowlist for seller registration.
```solidity
uint256 public registrationFee = 1 ether;

function registerSeller(string calldata apiBaseUrl, string calldata description) external payable {
    require(msg.value >= registrationFee, "X402: insufficient fee");
    // ... existing logic
}
```

## [DOS-3] Returndata bombing via `transferWithAuthorization` external call
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `settle()`
**Description**: The `settle()` function calls `IERC3009(token).transferWithAuthorization(...)` on an arbitrary token address (restricted only by the `supportedTokens` mapping, which is owner-controlled). If the owner adds a malicious or misbehaving token, the external call could return an arbitrarily large returndata payload. The EVM copies all returndata into memory, and memory expansion costs grow quadratically. A token returning megabytes of data could cause the transaction to run out of gas. This is mitigated by the fact that only the owner can add supported tokens, but the risk exists if a previously-legitimate token is upgraded (e.g., via proxy) to return excessive data.
**Proof of Concept**:
1. Owner adds a proxy-based token to `supportedTokens`.
2. The token implementation is later upgraded to return a large bytes payload from `transferWithAuthorization`.
3. All `settle()` calls for that token revert with out-of-gas due to memory expansion costs.
**Recommendation**: Use low-level calls with a bounded returndatasize when interacting with external token contracts, or use assembly to cap the returndata copy.
```solidity
(bool success, ) = token.call{gas: gasleft()}(
    abi.encodeCall(IERC3009.transferWithAuthorization, (from, recipient, value, validAfter, validBefore, nonce, v, r, s))
);
require(success, "X402: transfer failed");
```

## [DOS-4] Token transfer to blocklisted address causes permanent settlement failure
**Severity**: Medium
**Category**: evm-audit-dos
**Location**: `settle()`, `refund()`
**Description**: Certain ERC-20 tokens (notably USDC, USDT) maintain blocklists that prevent transfers to or from sanctioned addresses. In `settle()`, if `recipient` is blocklisted by the token, `transferWithAuthorization` will revert, preventing settlement even though the invoice ID and nonce have not been consumed (nonce IS consumed before the external call, but the entire transaction reverts). In `refund()`, if `payer` has been blocklisted after the original payment, `safeTransferFrom` will revert, making the refund permanently impossible -- the funds are stuck with the recipient with no alternative withdrawal path.
**Proof of Concept**:
1. A valid payment is settled to `recipient` for 100 USDC.
2. `payer` is subsequently added to the USDC blocklist (e.g., OFAC sanction).
3. `recipient` or owner calls `refund(invoiceId)` -- the `safeTransferFrom(recipient, payer, amount)` reverts because `payer` is blocklisted.
4. There is no alternative function to redirect the refund to a different address, so the refund is permanently stuck.
**Recommendation**: Add an alternative refund path that allows specifying a different refund destination, with appropriate authorization.
```solidity
function refundTo(bytes32 invoiceId, address refundRecipient) external nonReentrant {
    Payment storage p = payments[invoiceId];
    require(p.paidAt > 0, "X402: invoice not paid");
    require(p.amount > 0, "X402: already refunded");
    require(msg.sender == p.recipient || msg.sender == owner(), "X402: not authorized to refund");
    require(refundRecipient != address(0), "X402: zero refund recipient");
    uint256 amount = p.amount;
    address token = p.token;
    address recipient = p.recipient;
    p.amount = 0;
    IERC20(token).safeTransferFrom(recipient, refundRecipient, amount);
}
```

## [DOS-5] Zero-amount transfer revert potential in `refund()`
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `refund()`
**Description**: While the `refund()` function does check `p.amount > 0`, certain code paths or future modifications could lead to a zero-amount `safeTransferFrom`. Some ERC-20 tokens (e.g., LEND) revert on zero-amount transfers. Currently this is guarded by the `require(p.amount > 0)` check, so the risk is latent rather than active. However, `settle()` does not validate that the token actually transferred the expected amount (no balance check before/after), so if a fee-on-transfer token is supported, the recorded `amount` could be higher than what was actually received, causing refund to fail for the final partial amount.
**Proof of Concept**: This is a latent risk under the current implementation; the `require(p.amount > 0)` guard prevents it. The concern is relevant if fee-on-transfer tokens are ever supported, as the accounting mismatch could cascade into refund failures.
**Recommendation**: Consider adding a note in documentation that fee-on-transfer tokens are not supported, or add balance-before/after checks in `settle()`.

## [DOS-6] Block stuffing can prevent time-sensitive settlements
**Severity**: Low
**Category**: evm-audit-dos
**Location**: `settle()`
**Description**: The `settle()` function relies on ERC-3009 `transferWithAuthorization` which has a `validBefore` parameter acting as an expiry timestamp. An attacker could stuff blocks with high-gas transactions to prevent a legitimate `settle()` call from being included before `validBefore` expires. On L2s with low throughput or sequencer-controlled ordering, this is more feasible. Once `validBefore` passes, the authorization is expired and the payment cannot be settled, requiring the payer to sign a new authorization.
**Proof of Concept**:
1. Payer signs an ERC-3009 authorization with `validBefore = block.timestamp + 300` (5 minutes).
2. Attacker monitors the mempool and fills blocks with spam transactions for 5+ minutes.
3. The `settle()` transaction cannot be included before the authorization expires.
4. The payment fails and must be re-initiated.
**Recommendation**: Use sufficiently large `validBefore` windows to make block stuffing impractical. This is largely an operational concern rather than a contract-level fix.

## [DOS-7] `balanceOf()` revert in IERC3009 interface is unused but declared
**Severity**: Info
**Category**: evm-audit-dos
**Location**: `IERC3009` interface declaration
**Description**: The `IERC3009` interface declares a `balanceOf()` function, but it is never called in the contract. If it were used in a view function or as a precondition check, a reverting `balanceOf()` (e.g., from a paused or self-destructed token) would cause a DoS. Currently this is informational only since the function is not invoked anywhere.
**Recommendation**: Remove unused `balanceOf()` from the `IERC3009` interface to keep the interface minimal and avoid confusion.
```solidity
interface IERC3009 {
    function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external;
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
    // Remove: function balanceOf(address account) external view returns (uint256);
}
```
