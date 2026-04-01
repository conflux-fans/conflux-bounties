# Chain-Specific Audit Findings: X402PaymentVerifier on Conflux eSpace

**Contract**: `X402PaymentVerifier.sol`
**Chain**: Conflux eSpace (Chain ID 71 testnet / 1030 mainnet)
**Date**: 2026-04-02
**Checklist**: [evm-audit-chain-specific checklist](https://raw.githubusercontent.com/austintgriffith/evm-audit-skills/main/evm-audit-chain-specific/references/checklist.md)

---

## [CS-1] Block timestamp granularity differs on Conflux eSpace (~1s blocks vs 12s on Ethereum)
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `settle()` (line 287-290), `_refundTo()` (line 399), `release()` (line 339)
**Description**: Conflux eSpace produces blocks approximately every 1 second, compared to Ethereum's ~12 seconds. The contract uses `block.timestamp` for escrow timing (e.g., `DEFAULT_ESCROW_DURATION = 24 hours`, `MAX_AUTH_DURATION = 7 days`). While these are absolute durations and not block-count-based (which is correct), the higher block frequency means that `block.timestamp` advances with finer granularity. This is not a bug per se, but there is a subtle edge case: on Conflux eSpace, the `block.timestamp` can occasionally exhibit non-monotonic behavior within a single epoch, where multiple blocks in the same epoch may share the same timestamp. This means two transactions in consecutive blocks could see the same `block.timestamp`, which could allow a settle and release to occur in the same timestamp if `escrowDuration` is set to 0 (which `MIN_ESCROW_DURATION` allows). A seller could register with `escrowDuration = 0`, settle a payment, and release it in the same block, eliminating any refund window.
**Proof of Concept**:
1. Seller registers with `escrowDuration = 1` (the minimum non-zero value that `_validateEscrowDuration` returns as-is).
2. Seller calls `settle()` - `releaseAt` is set to `block.timestamp + 1`.
3. In the very next block (~1 second later), `block.timestamp >= releaseAt` is satisfied.
4. Seller calls `release()` - funds are released with effectively no meaningful refund window.
5. With `escrowDuration = 0`, the `_validateEscrowDuration` function returns `DEFAULT_ESCROW_DURATION` (24h), so that case is handled. But any value from 1 to a few seconds is accepted and creates a nearly instant release.
**Recommendation**: Enforce a meaningful minimum escrow duration rather than allowing `MIN_ESCROW_DURATION = 0`. Consider setting a minimum of at least 1 hour:
```solidity
uint256 public constant MIN_ESCROW_DURATION = 1 hours;
```
And update `_validateEscrowDuration` to enforce it for non-zero inputs:
```solidity
function _validateEscrowDuration(uint256 duration) internal pure returns (uint256) {
    if (duration == 0) return DEFAULT_ESCROW_DURATION;
    require(duration >= MIN_ESCROW_DURATION, "X402: escrow too short");
    require(duration <= MAX_ESCROW_DURATION, "X402: escrow too long");
    return duration;
}
```

---

## [CS-2] ERC-3009 `receiveWithAuthorization` signature domain may not include Conflux eSpace chain ID
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `settle()` (line 297-305)
**Description**: ERC-3009 `receiveWithAuthorization` uses EIP-712 typed data signatures which include a `DOMAIN_SEPARATOR` containing the chain ID. The contract delegates signature verification entirely to the token contract. If a token contract deployed on Conflux eSpace was deployed with a cached `DOMAIN_SEPARATOR` from another chain (e.g., if the token was deployed with the same bytecode on multiple chains without re-initializing the domain separator at deploy time), signatures from other chains could be replayed on Conflux eSpace, or vice versa. This is a known cross-chain replay risk for EIP-712 signatures. The X402PaymentVerifier contract itself has no mechanism to verify that the token's domain separator includes the correct chain ID. This is especially relevant because Conflux eSpace tokens (like USDT0, which is a cross-chain bridged token) may be deployed across multiple EVM chains.
**Proof of Concept**:
1. A token contract is deployed on both Conflux eSpace (chain ID 1030) and another EVM chain with the same address.
2. If the token contract caches `DOMAIN_SEPARATOR` at deploy time via `immutable` rather than computing it dynamically with `block.chainid`, and if there were a fork scenario, a signature valid on one chain could be replayed.
3. The X402PaymentVerifier has no way to detect this - it trusts the token contract's `receiveWithAuthorization` to validate correctly.
**Recommendation**: This is primarily a token-level risk, but the contract should document this assumption explicitly. Consider adding a check that the token contract's domain separator includes the expected chain ID, or at minimum document that only tokens with dynamically-computed domain separators (using `block.chainid` at runtime rather than cached at deploy time) should be added to the supported token list:
```solidity
/// @dev IMPORTANT: Only add tokens whose ERC-3009 implementation computes
///      DOMAIN_SEPARATOR dynamically using block.chainid (not cached at deploy).
///      This prevents cross-chain signature replay.
```

---

## [CS-3] Conflux eSpace transaction ordering and frontrunning characteristics differ from Ethereum
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `settle()` (line 263-325)
**Description**: Conflux eSpace uses a Tree-Graph consensus mechanism with a different transaction ordering model than Ethereum's priority-fee-based ordering. While the contract correctly restricts `settle()` to `msg.sender == recipient` (the seller), and uses `receiveWithAuthorization` (which requires the `to` parameter to match `msg.sender` of the calling contract), the frontrunning characteristics of Conflux eSpace are distinct. On Conflux eSpace, validators select transactions from the transaction pool differently than Ethereum miners/validators. The practical impact is that the frontrunning threat model assumed in the contract's design (which explicitly mentions "prevents front-running via receiveWithAuthorization" in the comments) may behave differently. Specifically, Conflux eSpace's faster block times (~1s) and different mempool dynamics could create different timing windows for griefing attacks.
**Proof of Concept**: A griefing attack where an attacker observes a pending `settle()` transaction in the mempool and attempts to front-run with a `transferWithAuthorization` call (using the same nonce) to a different address is mitigated by using `receiveWithAuthorization` instead. However, the contract's additional nonce tracking (`usedNonces` mapping at line 293) creates a different griefing vector: if an attacker can extract the authorization parameters from the mempool and call the token's `transferWithAuthorization` before the seller's `settle()` is mined, the authorization nonce is consumed at the token level, causing the `receiveWithAuthorization` in `settle()` to revert. The seller would need to obtain a new authorization from the buyer. This is an inherent limitation of ERC-3009, not specific to this contract, but Conflux eSpace's transaction ordering may make this easier or harder depending on mempool visibility.
**Recommendation**: Acknowledge this in documentation. The use of `receiveWithAuthorization` (rather than `transferWithAuthorization`) is the correct mitigation. No code change needed, but consider documenting the residual griefing risk for integrators.

---

## [CS-4] OpenZeppelin v5.x compiled with Solidity 0.8.24 - PUSH0 mitigation verified
**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: `hardhat.config.ts` (line 10)
**Description**: The contract uses Solidity 0.8.24 with OpenZeppelin v5.6.1. Solidity >= 0.8.20 defaults to the Shanghai EVM version which emits the `PUSH0` opcode. Conflux eSpace added PUSH0 support in the Hardfork v2.4.0 upgrade (late 2024), but the project correctly sets `evmVersion: "paris"` in the Hardhat config, which avoids emitting `PUSH0` entirely. This is the recommended approach for maximum compatibility.
**Proof of Concept**: N/A - no vulnerability. This is a positive finding confirming correct configuration.
**Recommendation**: No change needed. The `evmVersion: "paris"` setting correctly prevents PUSH0 emission. If the project later upgrades and a developer removes this setting, PUSH0 would be emitted - consider adding a comment in `hardhat.config.ts` explaining why `paris` is specified.

---

## [CS-5] No hardcoded token or infrastructure addresses - multi-chain portable
**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: Constructor (line 132-139), `setSupportedToken()` (line 420-427)
**Description**: The checklist flags hardcoded token addresses (WETH, USDC, etc.) and infrastructure contract addresses (Uniswap factories, Gnosis Safe singletons) as a common multi-chain deployment error. This contract correctly avoids all hardcoded addresses. Token support is configurable via the constructor and `setSupportedToken()`. No external protocol addresses are referenced. This makes the contract portable across Conflux eSpace testnet (chain 71) and mainnet (chain 1030) without code changes.
**Proof of Concept**: N/A - positive finding.
**Recommendation**: No change needed.

---

## [CS-6] Seller can set escrow duration to 1 second, effectively bypassing buyer protection
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `_validateEscrowDuration()` (line 471-476), `registerSeller()` (line 154)
**Description**: `MIN_ESCROW_DURATION` is set to 0, and `_validateEscrowDuration()` only uses the default (24h) when the input is exactly 0. Any non-zero value between 1 and `MAX_ESCROW_DURATION` (30 days) is accepted. On Conflux eSpace with ~1 second block times, a seller can register with `escrowDuration = 1` (1 second). After settling a payment, the seller can call `release()` in the very next block, making refunds practically impossible. This creates a trust model violation: buyers may assume the x402 escrow provides a meaningful refund window, but a malicious seller can eliminate it entirely. This is exacerbated on Conflux eSpace because the 1-second block time means even small escrow values expire almost immediately.
**Proof of Concept**:
1. Malicious seller calls `registerSeller("https://evil.com", "desc", 1)` - escrow duration is 1 second.
2. Buyer signs an ERC-3009 authorization for payment.
3. Seller calls `settle()` in block N. `releaseAt = block.timestamp + 1`.
4. Seller calls `release()` in block N+1 (1 second later). `block.timestamp >= releaseAt` passes.
5. Buyer has no practical window to request a refund. Note: only the seller can refund, but any external dispute resolution mechanism has zero time to act.
**Recommendation**: Set a meaningful minimum escrow duration:
```solidity
uint256 public constant MIN_ESCROW_DURATION = 1 hours;
```
Update the validation to enforce the minimum for non-zero values (already does via the `require` check, but `MIN_ESCROW_DURATION` being 0 makes it a no-op):
```solidity
function _validateEscrowDuration(uint256 duration) internal pure returns (uint256) {
    if (duration == 0) return DEFAULT_ESCROW_DURATION;
    require(duration >= MIN_ESCROW_DURATION, "X402: escrow too short");
    require(duration <= MAX_ESCROW_DURATION, "X402: escrow too long");
    return duration;
}
```
With `MIN_ESCROW_DURATION = 1 hours`, the existing logic works correctly.
