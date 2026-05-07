# Chain-Specific Security Audit: X402PaymentVerifier on Conflux eSpace

**Contract**: `X402PaymentVerifier.sol`
**Chain**: Conflux eSpace (EVM-compatible, chain IDs 1030/71)
**Auditor**: Claude Opus 4.6
**Date**: 2026-04-02

---

## [CHAIN-1] PUSH0 opcode usage risk from pragma ^0.8.24 despite paris EVM target

**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `pragma solidity ^0.8.24` (file line 2) and `hardhat.config.ts` line 10
**Description**: The contract uses `pragma solidity ^0.8.24`, which corresponds to Solidity versions that default to the `shanghai` EVM target (which introduced the PUSH0 opcode). Conflux eSpace does not support PUSH0. The current Hardhat config correctly sets `evmVersion: "paris"` to avoid PUSH0, but this is a deployment-config-level mitigation only. If the contract is compiled by any other toolchain (Foundry, Remix, a CI pipeline, or a verification service) without explicitly setting `evmVersion: "paris"`, the resulting bytecode will contain PUSH0 and fail to deploy or execute on Conflux eSpace.

**Proof of Concept**:
1. Clone the repo and remove or ignore the `evmVersion: "paris"` setting.
2. Compile with `solc 0.8.24` using defaults (shanghai target).
3. Attempt deployment on Conflux eSpace -- transaction reverts because PUSH0 (0x5F) is an invalid opcode.

**Recommendation**: Pin the pragma to a version below 0.8.20 (which introduced shanghai default), or add an explicit comment and a compile-time assertion. The safest fix is to enforce the EVM version in the contract source itself:

```solidity
// Option A: Use a pre-shanghai pragma
pragma solidity ^0.8.19;

// Option B: Keep 0.8.24 but document the hard requirement
/// @custom:evm-version paris
/// @dev MUST be compiled with evmVersion "paris" for Conflux eSpace (no PUSH0 support)
pragma solidity ^0.8.24;
```

Additionally, add a Foundry `foundry.toml` or CI check that enforces `evm_version = "paris"` if other build systems are used.

---

## [CHAIN-2] Hardcoded mainnet token addresses in deploy script create deployment fragility

**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `scripts/deploy.ts` lines 6-7
**Description**: The deploy script hardcodes two token addresses for Conflux eSpace mainnet: USDT0 (`0xaf37...`) and AxCNH (`0x70bf...`). On EVM-compatible L2s and alt-chains, bridged token addresses are chain-specific and can change if the bridge implementation is upgraded or tokens are redeployed. If these addresses become stale (e.g., a token migration like MATIC->POL, or a bridge upgrade that changes the proxy address), deployment would register non-functional or wrong tokens.

While the contract has a timelock mechanism for adding new tokens (proposeToken/activateToken), the constructor bypasses this timelock entirely, making the initial token list a trust-on-first-deployment decision with no safety delay.

**Proof of Concept**:
1. A token contract at `0xaf37...` is migrated to a new address by the token issuer.
2. The deploy script still references the old address.
3. The contract is deployed with a stale/defunct token as "supported," and settlements against that token would fail or interact with the wrong contract.

**Recommendation**: Validate token addresses at deploy time by querying `name()`, `symbol()`, and `decimals()` from the on-chain contracts and logging them for human verification. Add an address registry or environment variable override:

```typescript
const MAINNET_TOKENS = (process.env.MAINNET_TOKENS || "").split(",").filter(Boolean);
if (isMainnet && MAINNET_TOKENS.length === 0) {
  throw new Error("MAINNET_TOKENS env var required for mainnet deploy");
}
```

---

## [CHAIN-3] Frontrunning of settle() is possible on Conflux eSpace

**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: `settle()` (line 285-352)
**Description**: Conflux eSpace, unlike some L2s with a centralized sequencer that enforces ordering (e.g., Arbitrum, Optimism), uses a PoS/PoW hybrid consensus where miners/validators have the ability to reorder transactions within a block. This means mempool-based frontrunning is possible, similar to Ethereum L1.

The contract mitigates this well by using `receiveWithAuthorization` (which requires `msg.sender == to`, where `to` is the contract itself) and by requiring `msg.sender == recipient`. This means only the intended seller can call `settle()` with the buyer's ERC-3009 authorization, and the authorization itself specifies `to = address(this_contract)`.

However, a malicious miner/validator on Conflux eSpace could still reorder a seller's `settle()` transaction relative to a buyer's `cancelAuthorization` transaction on the ERC-3009 token. If the buyer attempts to cancel their authorization and a validator prioritizes the seller's `settle()` first, the buyer loses the race.

This is informational because it is inherent to the ERC-3009 design on any chain with miner-extractable ordering, and the contract cannot mitigate it further.

**Proof of Concept**: Buyer signs authorization, then submits `cancelAuthorization` on the USDT0 contract. Seller simultaneously submits `settle()`. A validator seeing both in the mempool can order `settle()` first.

**Recommendation**: Document this as a known limitation for buyers. Consider adding documentation that buyers should set tight `validAfter`/`validBefore` windows to limit exposure.

---

## [CHAIN-4] Registration fee withdrawal sends entire CFX balance, including any accidental deposits

**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `withdrawFees()` (line 513-518)
**Description**: The `withdrawFees()` function sends `address(this).balance` -- the entire native CFX balance of the contract -- to the owner. On Conflux eSpace, CFX is the native token (analogous to ETH). If anyone accidentally sends CFX directly to this contract (which is possible since there is no `receive()` or `fallback()` function to reject it -- but CFX can still be force-sent via `selfdestruct` or coinbase rewards), those funds would be swept by the owner.

More importantly, the `registerSeller()` and `reactivateSeller()` functions accept `msg.value >= registrationFee` but do not refund excess. Any overpayment in CFX is permanently locked until the owner calls `withdrawFees()`, at which point the owner receives the overpayment.

**Proof of Concept**:
1. Registration fee is set to 1 CFX.
2. A seller calls `registerSeller{value: 2 CFX}(...)` (overpays by 1 CFX).
3. The excess 1 CFX is not refunded and becomes part of the owner's withdrawable balance.

**Recommendation**: Refund excess CFX in registration functions:

```solidity
function registerSeller(...) external payable {
    require(msg.value >= registrationFee, "X402: insufficient registration fee");
    // ... registration logic ...

    // Refund excess
    uint256 excess = msg.value - registrationFee;
    if (excess > 0) {
        (bool refunded, ) = msg.sender.call{value: excess}("");
        require(refunded, "X402: refund failed");
    }
}
```

---

## [CHAIN-5] block.chainid checked at runtime but DEPLOYMENT_CHAIN_ID is immutable -- safe pattern confirmed

**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: `constructor()` line 148, `settle()` line 298
**Description**: The contract stores `block.chainid` at deployment as an immutable value and checks `block.chainid == DEPLOYMENT_CHAIN_ID` at runtime in `settle()`. This is the correct pattern for cross-chain replay protection -- `block.chainid` is read dynamically (not cached in a way that could become stale after a hard fork that changes the chain ID).

However, this check only exists in `settle()`. The `release()`, `releaseTo()`, `refund()`, and `refundTo()` functions do not check `block.chainid`. On a hypothetical chain fork where the same contract state exists on two chains, an already-settled payment could be released or refunded on the forked chain without the chain ID check. This is a very low probability scenario and the impact is limited since the payment data would need to exist on both chains.

**Proof of Concept**: Theoretical only -- requires a Conflux eSpace chain fork where contract state is replicated.

**Recommendation**: No action required for current deployment. If defense-in-depth is desired, add the chain ID check to `release()` and `refund()` as well.

---

## Summary

| ID | Title | Severity |
|----|-------|----------|
| CHAIN-1 | PUSH0 opcode risk from pragma ^0.8.24 | Low |
| CHAIN-2 | Hardcoded mainnet token addresses in deploy script | Low |
| CHAIN-3 | Frontrunning possible on Conflux eSpace | Info |
| CHAIN-4 | CFX overpayment not refunded in registration | Low |
| CHAIN-5 | Chain ID check missing in release/refund paths | Info |

**Overall Assessment**: The contract is well-designed for Conflux eSpace deployment. The most critical chain-specific concern (PUSH0) is already mitigated via the Hardhat config's `evmVersion: "paris"` setting, though this is a build-config dependency rather than a source-level guarantee. The contract correctly uses `.call{value:}` instead of `.transfer()`/`.send()` for native CFX transfers, properly checks `block.chainid` dynamically in the settlement path, and uses `SafeERC20` for token operations. No critical or high severity chain-specific findings were identified.
