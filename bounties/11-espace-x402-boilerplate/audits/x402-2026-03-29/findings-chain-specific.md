# Chain-Specific Audit Findings: x402 Contracts on Conflux eSpace

**Date**: 2026-03-29
**Contracts**: `X402PaymentVerifier.sol`, `MockUSDT0.sol`
**Target Chain**: Conflux eSpace (EVM-compatible space, chain IDs 71 / 1030)
**Compiler**: Solidity 0.8.24, viaIR enabled, optimizer 200 runs
**OpenZeppelin**: v5.6.1

---

## [CS-1] PUSH0 Opcode May Not Be Supported on Conflux eSpace
**Severity**: High
**Category**: evm-audit-chain-specific
**Location**: Both contracts (compiler target)
**Description**: Solidity 0.8.20+ emits the `PUSH0` opcode (introduced in Ethereum's Shanghai upgrade). Conflux eSpace may not yet support this opcode depending on its current hard fork level. If `PUSH0` is unsupported, deployment transactions will revert with no clear error, resulting in a total inability to deploy either contract. The hardhat config does not specify an `evmVersion` override, so the compiler defaults to the latest EVM version for Solidity 0.8.24 (which is `cancun`, including `PUSH0`).
**Proof of Concept**:
1. Compile both contracts with Solidity 0.8.24 using default `evmVersion`.
2. Attempt to deploy to Conflux eSpace testnet (chain ID 71).
3. If Conflux eSpace's VM does not implement `PUSH0`, deployment reverts.
**Recommendation**: Explicitly set the EVM version to `paris` (pre-Shanghai) in `hardhat.config.ts` to avoid `PUSH0`:
```typescript
solidity: {
  version: "0.8.24",
  settings: {
    viaIR: true,
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
  },
},
```

---

## [CS-2] Immutable DOMAIN_SEPARATOR Breaks on Chain ID Change or Cross-Chain Replay
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `MockUSDT0.sol` constructor (line 29-37)
**Description**: The `DOMAIN_SEPARATOR` is computed once in the constructor using `block.chainid` and stored as `immutable`. If Conflux eSpace ever undergoes a chain ID change (e.g., during a hard fork or network migration), or if the contract is deployed on both testnet (chain ID 71) and mainnet (chain ID 1030), signatures created for one chain could be replayed on the other if the same contract address is achieved via CREATE2. EIP-712 best practice (and OpenZeppelin's EIP712 implementation) is to recompute the domain separator dynamically when `block.chainid` differs from the cached value.
**Proof of Concept**:
1. Deploy `MockUSDT0` on Conflux eSpace testnet (chain ID 71).
2. User signs a `transferWithAuthorization` on testnet.
3. If the same contract exists at the same address on another chain (via CREATE2 or coincidental address), the signature is valid there too since the domain separator was baked in at deploy time and there is no runtime chain ID check.
**Recommendation**: Replace the immutable `DOMAIN_SEPARATOR` with a function that recomputes it if `block.chainid` has changed:
```solidity
bytes32 private immutable _cachedDomainSeparator;
uint256 private immutable _cachedChainId;

function DOMAIN_SEPARATOR() public view returns (bytes32) {
    if (block.chainid == _cachedChainId) {
        return _cachedDomainSeparator;
    }
    return _computeDomainSeparator();
}
```

---

## [CS-3] block.timestamp Granularity Difference on Conflux eSpace
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `MockUSDT0.sol:65-66` (`transferWithAuthorization`), `X402PaymentVerifier.sol:211` (`settle`)
**Description**: Conflux eSpace has different block times than Ethereum mainnet (roughly 0.5-1 second vs 12 seconds). The ERC-3009 `validAfter` / `validBefore` window checks in `MockUSDT0` use strict inequalities (`block.timestamp > validAfter` and `block.timestamp < validBefore`). While functionally correct, the faster block times on Conflux mean that very tight authorization windows (e.g., a few seconds) may behave differently than expected. Additionally, `block.timestamp` on Conflux eSpace is sourced from the Conflux Core consensus layer and may have different reliability characteristics than Ethereum L1.
**Proof of Concept**: A user creates an authorization with `validAfter = now` and `validBefore = now + 5`. Due to faster block production, more blocks occur within the window, but the timestamp progression itself may be less granular than expected, causing edge-case failures.
**Recommendation**: Document minimum recommended authorization window durations for Conflux eSpace (suggest at least 300 seconds). No code change required, but consider adding a minimum window check:
```solidity
require(validBefore - validAfter >= 60, "USDT0: auth window too short");
```

---

## [CS-4] Frontrunning of transferWithAuthorization in Conflux eSpace Public Mempool
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `X402PaymentVerifier.sol:settle()`, `MockUSDT0.sol:transferWithAuthorization()`
**Description**: Conflux eSpace transactions go through a public mempool. The `settle()` function in `X402PaymentVerifier` calls `transferWithAuthorization()` (not `receiveWithAuthorization()`). Since `transferWithAuthorization` does not check `msg.sender`, any observer who sees a pending `settle()` transaction in the mempool can extract the ERC-3009 signature parameters and call `transferWithAuthorization()` directly on the token contract, transferring funds to the intended recipient but bypassing the `X402PaymentVerifier` entirely. This means:
1. The payment record in `X402PaymentVerifier.payments` is never created.
2. The `PaymentReceived` event is never emitted.
3. The `usedNonces` guard in the verifier is not set (only the token-level nonce is consumed).
4. `verifyPayment()` returns false, so the seller's API denies access despite the buyer's funds being transferred.

The buyer loses funds without receiving service, or the seller receives funds without the verifier recording it.
**Proof of Concept**:
1. Seller submits `settle()` with the buyer's ERC-3009 authorization.
2. A frontrunner sees the transaction in the Conflux eSpace mempool.
3. Frontrunner extracts `(from, to, value, validAfter, validBefore, nonce, v, r, s)` and calls `MockUSDT0.transferWithAuthorization()` directly.
4. The frontrunner's tx is mined first. Tokens move from buyer to seller (the `to` address in the signature).
5. The original `settle()` tx reverts because the token-level nonce is already consumed.
6. `X402PaymentVerifier.payments[invoiceId]` is never populated due to the revert.
**Recommendation**: Use `receiveWithAuthorization()` instead of `transferWithAuthorization()`. This requires the verifier contract to be the `to` address in the signed message, then the contract forwards funds to the seller. Alternatively, accept that the `to` field is the seller and have the contract call `receiveWithAuthorization()` as `msg.sender == to` (which would require the contract to be the recipient, changing the flow). A simpler mitigation: have the settle function check on-chain (after the call) that the token-level nonce was consumed, or wrap the `transferWithAuthorization` call in a try/catch and verify the balance changed:
```solidity
uint256 balBefore = IERC3009(token).balanceOf(recipient);
IERC3009(token).transferWithAuthorization(from, recipient, value, validAfter, validBefore, nonce, v, r, s);
require(IERC3009(token).balanceOf(recipient) >= balBefore + value, "X402: transfer failed");
```
However, the fundamental frontrunning risk remains. Document that off-chain settlement confirmation should also check the token's `authorizationState` as a fallback.

---

## [CS-5] Hardcoded Mainnet USDT0 Address in Comments May Cause Deployment Confusion
**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: `MockUSDT0.sol:10`
**Description**: The comment references a mainnet USDT0 address (`0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff`). Bridged token addresses on Conflux eSpace differ from those on Ethereum or other L2s. If developers copy this address for mainnet deployment of `X402PaymentVerifier` (in the constructor's `_tokens` array), they must verify it is the correct USDT0 address specifically on Conflux eSpace mainnet (chain ID 1030), not on another chain.
**Proof of Concept**: Developer deploys `X402PaymentVerifier` on Conflux eSpace mainnet passing the address from the comment, which may correspond to a different or nonexistent contract on Conflux eSpace.
**Recommendation**: Verify and document the correct USDT0 contract address on Conflux eSpace mainnet. Add a deployment script check that validates `IERC3009(token).balanceOf(address(0))` does not revert (i.e., the address is a valid contract with the expected interface).

---

## [CS-6] USDT/USDC Decimal Assumptions Are Implicit
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `MockUSDT0.sol:40-42`, `X402PaymentVerifier.sol:settle()`
**Description**: `MockUSDT0` hardcodes `decimals()` to 6. The `X402PaymentVerifier` is token-agnostic and treats `value` as an opaque uint256. However, bridged stablecoins on Conflux eSpace may have different decimal configurations than their counterparts on Ethereum. For example, some bridged USDT variants use 18 decimals. If a future supported token has different decimals than expected, the `verifyPayment()` function's `expectedAmount` comparison could silently pass or fail with wrong magnitudes.
**Proof of Concept**:
1. Owner adds a bridged USDT variant with 18 decimals as a supported token.
2. Off-chain pricing logic assumes 6 decimals and sets `value = 1_000_000` for $1.
3. The actual transfer moves 0.000000000001 tokens (1e-12), far less than intended.
**Recommendation**: Consider adding an optional decimals field to the supported tokens mapping, or document clearly that off-chain systems must query `decimals()` per-token before constructing payment authorizations. A registry approach:
```solidity
mapping(address => uint8) public tokenDecimals; // 0 = not supported
```

---

## [CS-7] sellerList Array Grows Unboundedly, Risking Gas Limit Issues on getActiveSellers()
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `X402PaymentVerifier.sol:303-318` (`getActiveSellers()`)
**Description**: The `sellerList` array only grows (via `registerSeller`) and is never pruned. `getActiveSellers()` iterates the entire array twice. On Conflux eSpace, while gas limits may differ from Ethereum mainnet, the RPC node gas limit for `eth_call` (view functions) varies by provider. With enough registered sellers (even if most are deactivated), this function may exceed the call gas limit and become unusable. Conflux eSpace block gas limits and RPC call limits may be configured differently than Ethereum.
**Proof of Concept**: After ~1000+ seller registrations (including deactivated ones), `getActiveSellers()` may revert or time out on standard Conflux eSpace RPC endpoints.
**Recommendation**: The contract already includes a warning comment. For production, add pagination:
```solidity
function getActiveSellers(uint256 offset, uint256 limit) external view returns (Seller[] memory) { ... }
```

---

## [CS-8] No EIP-1559 Fee Considerations for Settle Transaction Gas Costs
**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: `X402PaymentVerifier.sol:settle()`
**Description**: Conflux eSpace implements a fee mechanism that may differ from Ethereum's EIP-1559. The `settle()` function is gas-intensive (external call to token contract + multiple storage writes). The facilitator/seller who pays gas should be aware that Conflux eSpace gas pricing may behave differently, and the base fee burn mechanism may not exist or may work differently. This affects the economics of who pays for settlement transactions.
**Proof of Concept**: N/A -- informational.
**Recommendation**: Document Conflux eSpace gas pricing characteristics for facilitators. Consider adding a gas stipend or reimbursement mechanism if settlement costs are expected to be borne by sellers.

---

## [CS-9] ecrecover Returns address(0) on Invalid Input Without Revert
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `MockUSDT0.sol:79-80`, `MockUSDT0.sol:119-120`, `MockUSDT0.sol:150-151`
**Description**: The `ecrecover` precompile behavior is consistent across EVM-compatible chains including Conflux eSpace. The contract correctly checks `recovered != address(0)`. However, ecrecover on some EVM-compatible chains has had subtle differences in edge cases (e.g., non-canonical `s` values). The contract does not enforce that `s` is in the lower half of the curve order (EIP-2 / EIP-155 malleability protection). While the nonce-based replay protection mitigates most signature malleability attacks, this is a defense-in-depth gap.
**Proof of Concept**:
1. Attacker observes a valid signature `(v, r, s)` for a `transferWithAuthorization`.
2. Attacker computes the complementary signature `(v', r, N - s)` where N is the secp256k1 order.
3. Both signatures recover to the same address. However, since the nonce is already consumed after the first use, the second attempt fails at the nonce check.
4. Risk is theoretical -- nonce protection is sufficient, but malleable signatures could cause confusion in off-chain systems.
**Recommendation**: Add `s`-value malleability check for defense in depth:
```solidity
require(uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0, "USDT0: invalid s value");
```
Or use OpenZeppelin's `ECDSA.recover()` which includes this check.
