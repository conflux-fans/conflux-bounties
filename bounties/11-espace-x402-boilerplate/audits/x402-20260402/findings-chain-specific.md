# Chain-Specific Audit Findings: X402PaymentVerifier on Conflux eSpace

**Contract**: `X402PaymentVerifier.sol`
**Chain**: Conflux eSpace (Chain ID 71 testnet / 1030 mainnet)
**Date**: 2026-04-02
**Checklist**: evm-audit-chain-specific

---

## [CHAIN-1] Cross-Chain ERC-3009 Authorization Replay
**Severity**: Critical
**Category**: evm-audit-chain-specific
**Location**: `settle()`
**Description**: If this contract is deployed at the same address on multiple EVM chains (e.g., Conflux eSpace and Ethereum mainnet), an ERC-3009 `receiveWithAuthorization` signed for one chain could be replayed on another. The ERC-3009 standard uses EIP-712 typed data with a `DOMAIN_SEPARATOR` that should include `block.chainid`, but this protection depends entirely on the token contract's implementation. If the token contract caches an immutable `DOMAIN_SEPARATOR` at deployment (as many older implementations do) rather than computing it dynamically, cross-chain replay is possible. The `usedNonces` mapping in this contract is local to each deployment and provides no cross-chain protection. The contract emits `block.chainid` in the `PaymentReceived` event but never validates it against an expected value.
**Proof of Concept**:
1. Contract is deployed at the same address on Conflux eSpace (chain ID 1030) and another EVM chain.
2. User signs a `receiveWithAuthorization` for USDT0 on Conflux eSpace.
3. Attacker (or the seller) takes the same signature parameters and calls `settle()` on the other chain where the same token exists with a compatible `DOMAIN_SEPARATOR`.
4. The payment executes on both chains, double-spending the payer's funds.
**Recommendation**: Add an immutable `EXPECTED_CHAIN_ID` set in the constructor and validate it in `settle()`:
```solidity
uint256 public immutable EXPECTED_CHAIN_ID;

constructor(address[] memory _tokens) Ownable(msg.sender) {
    EXPECTED_CHAIN_ID = block.chainid;
    // ...
}

function settle(...) external nonReentrant {
    require(block.chainid == EXPECTED_CHAIN_ID, "X402: wrong chain");
    // ...
}
```
Additionally, document that only tokens with dynamically-computed `DOMAIN_SEPARATOR` (using `block.chainid` at runtime) should be added to the supported token list.

---

## [CHAIN-2] PUSH0 Opcode Compatibility With Conflux eSpace
**Severity**: High
**Category**: evm-audit-chain-specific
**Location**: `pragma solidity ^0.8.24;`
**Description**: The contract uses `pragma solidity ^0.8.24`, which allows compilation with Solidity 0.8.24+. Starting from Solidity 0.8.20, the compiler defaults to the Shanghai EVM target, which emits the `PUSH0` opcode (EIP-3855). Conflux eSpace added PUSH0 support in the Hardfork v2.4.0 upgrade (late 2024), but the project's Hardhat config sets `evmVersion: "paris"`, which correctly avoids PUSH0 emission. However, the pragma itself allows any compiler >= 0.8.24, meaning if anyone compiles this contract without the Hardhat config (e.g., using Remix, Foundry with default settings, or a different build tool), the resulting bytecode will contain PUSH0. If deployed to a Conflux eSpace node that has not yet upgraded to v2.4.0, or if the PUSH0 support has any edge-case incompatibilities, deployment or execution will fail silently.
**Proof of Concept**:
1. Developer clones the contract source and compiles with `solc 0.8.24` directly (no Hardhat config).
2. Default EVM target is Shanghai, emitting `PUSH0` opcodes.
3. Deployment to Conflux eSpace succeeds if PUSH0 is supported, fails if not.
4. The pragma does not enforce the EVM version.
**Recommendation**: The existing `evmVersion: "paris"` in hardhat.config.ts is the correct mitigation. Add an explicit comment in the contract source near the pragma explaining this dependency:
```solidity
/// @dev MUST be compiled with evmVersion "paris" for Conflux eSpace compatibility.
///      Solidity >= 0.8.20 defaults to Shanghai which emits PUSH0. Ensure your
///      build tool targets Paris or verify PUSH0 support on the target chain.
pragma solidity ^0.8.24;
```

---

## [CHAIN-3] Seller Can Set Escrow Duration to 1 Second, Exploitable With 0.5s Block Times
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `_validateEscrowDuration()`, `registerSeller()`, `settle()`, `release()`
**Description**: `MIN_ESCROW_DURATION` is set to 0, and `_validateEscrowDuration()` accepts any value between 0 and `MAX_ESCROW_DURATION` (30 days). A seller can register with `escrowDuration = 1` (1 second). On Conflux eSpace with ~0.5s block times, the seller can call `release()` in the very next block after `settle()`, giving the payer virtually zero refund window. Even `escrowDuration = 0` results in `releaseAt == paidAt`, meaning `release()` can be called in the same block or the next block. This is significantly worse on Conflux than Ethereum because Conflux produces blocks ~24x faster, so even a few seconds of escrow evaporate across just a handful of blocks.
**Proof of Concept**:
1. Malicious seller calls `registerSeller("https://evil.com", "desc", 0)` -- escrow duration 0.
2. Buyer signs ERC-3009 authorization.
3. Seller calls `settle()` in block N. `releaseAt = block.timestamp + 0 = block.timestamp`.
4. Seller calls `release()` in the same transaction batch or next block (~0.5s). `block.timestamp >= releaseAt` passes immediately.
5. Buyer has no practical window to dispute via any external mechanism.
**Recommendation**: Enforce a meaningful minimum escrow duration:
```solidity
uint256 public constant MIN_ESCROW_DURATION = 1 hours;

function _validateEscrowDuration(uint256 duration) internal pure returns (uint256) {
    if (duration == 0) return DEFAULT_ESCROW_DURATION;
    require(duration >= MIN_ESCROW_DURATION, "X402: escrow too short");
    require(duration <= MAX_ESCROW_DURATION, "X402: escrow too long");
    return duration;
}
```

---

## [CHAIN-4] Tree-Graph Consensus Reorg Risk for Timestamp-Based Escrow Boundaries
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `settle()`, `release()`, `_refundTo()`
**Description**: Conflux uses a tree-graph consensus mechanism rather than a linear chain. While eSpace provides EVM compatibility, the underlying consensus can experience reorganizations differently than Ethereum. The contract relies entirely on `block.timestamp` for escrow boundaries: `settle()` sets `releaseAt = block.timestamp + escrowDuration`, `release()` requires `block.timestamp >= p.releaseAt`, and `_refundTo()` requires `block.timestamp < p.releaseAt`. Near the escrow boundary, a reorg could cause a `settle()` transaction to be re-included in a different block with a different timestamp, shifting `releaseAt`. A refund that was valid pre-reorg could become invalid post-reorg (or vice versa), leading to inconsistent state between what the seller/buyer observed and what actually finalized.
**Proof of Concept**:
1. Payment is settled at timestamp T with `releaseAt = T + 3600`.
2. At timestamp T + 3599, seller initiates a refund. The check `block.timestamp < p.releaseAt` passes.
3. A tree-graph reorg occurs. The `settle()` transaction is re-included in a block with timestamp T-2.
4. Now `releaseAt = T - 2 + 3600 = T + 3598`. The refund at T + 3599 would now fail because `T + 3599 >= T + 3598`.
5. Alternatively, the refund transaction itself could be re-included at a different timestamp, changing the outcome.
**Recommendation**: Add a small buffer to escrow boundary checks to account for potential timestamp drift during reorgs. For example, add a grace period to refund eligibility:
```solidity
uint256 public constant ESCROW_GRACE_PERIOD = 5 minutes;
// In _refundTo:
require(block.timestamp < p.releaseAt + ESCROW_GRACE_PERIOD, "X402: escrow period ended");
```
Document the reorg risk for integrators and recommend waiting for sufficient block confirmations before considering escrow boundaries final.

---

## [CHAIN-5] Gas Cost Differences Enable Seller Registration Spam on Conflux
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `registerSeller()`, `reactivateSeller()`
**Description**: Gas costs on Conflux eSpace are significantly cheaper than Ethereum mainnet, and CFX is substantially cheaper than ETH. The `registrationFee` defaults to 0 and must be explicitly set by the owner via `setRegistrationFee()`. Even when set, the fee is denominated in native CFX, which has much lower value than ETH. Combined with cheap gas, a malicious actor could register thousands of sellers, bloating the `sellerList` array. This degrades `getActiveSellers()` performance and increases gas costs for legitimate pagination queries. The `sellerList` array has no upper bound.
**Proof of Concept**:
1. Owner deploys contract without setting `registrationFee` (defaults to 0).
2. Attacker calls `registerSeller()` from thousands of addresses at near-zero gas cost on Conflux eSpace.
3. `sellerList` grows unboundedly.
4. `getActiveSellers()` with large offsets becomes expensive.
5. Even with a fee, CFX's low price makes spam economically viable compared to Ethereum.
**Recommendation**: Set `registrationFee` to a meaningful default in the constructor. Add an upper bound on `sellerList.length`:
```solidity
uint256 public constant MAX_SELLERS = 10000;
require(sellerList.length < MAX_SELLERS, "X402: seller limit reached");
```

---

## [CHAIN-6] ERC-3009 Token Decimal Assumptions (USDT0 on Conflux)
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `settle()`, `verifyPayment()`
**Description**: The contract handles ERC-3009 tokens on Conflux eSpace (specifically USDT0) without any decimal validation or normalization. USDT0 is a cross-chain stablecoin that may use different decimals than USDT on Ethereum (6 decimals). The `verifyPayment` function compares `p.amount < expectedAmount` directly without any awareness of token decimals. If an off-chain system assumes 6 decimals but the token uses 18 (or vice versa), payment verification will produce incorrect results. The contract stores `received` (actual tokens transferred) in `p.amount`, but the `value` parameter passed to `settle()` represents the nominal amount in the token's native decimal scaling, which could differ across chains.
**Proof of Concept**:
1. Backend system is coded assuming USDT0 has 6 decimals (like USDT on Ethereum).
2. USDT0 on Conflux uses 18 decimals.
3. Seller wants to charge 1 USDT0. Backend sets `expectedAmount = 1e6`.
4. Buyer pays 1 USDT0, which is `1e18` in token units.
5. `verifyPayment` checks `p.amount (1e18) < expectedAmount (1e6)` -- this passes (1e18 is not less than 1e6), so verification succeeds but the amounts are semantically mismatched.
**Recommendation**: Store the token decimals alongside each supported token. Add a `tokenDecimals` mapping populated during `activateToken()`:
```solidity
mapping(address => uint8) public tokenDecimals;
```
Document the expected decimals for each supported token. Consider querying `IERC20Metadata(token).decimals()` during token activation and storing the result for off-chain reference.

---

## [CHAIN-7] block.timestamp Granularity Creates Wider MEV Windows on Conflux
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `settle()`
**Description**: With Conflux eSpace's ~0.5s block times, authorization validity windows span many more blocks than they would on Ethereum. A `validBefore` of `now + 300` (5 minutes) spans ~600 blocks on Conflux vs ~25 on Ethereum. While `receiveWithAuthorization` mitigates direct front-running (since only the designated `to` address can receive), the expanded block window increases exposure to griefing attacks where an attacker calls `transferWithAuthorization` on the token contract directly to consume the authorization nonce before `settle()` is mined. The `MAX_AUTH_DURATION` of 7 days represents approximately 1,209,600 blocks on Conflux, providing a very large window for such attacks.
**Proof of Concept**:
1. Payer signs an authorization with `validBefore = now + 7 days`.
2. Authorization parameters are visible in the mempool or transmitted off-chain.
3. Attacker monitors for ~1.2M blocks on Conflux, waiting for an opportune moment.
4. Attacker calls `transferWithAuthorization` on the token contract to consume the nonce.
5. Seller's subsequent `settle()` call reverts because the authorization is already consumed.
**Recommendation**: Consider a tighter `MAX_AUTH_DURATION` for Conflux deployment (e.g., 1 day instead of 7 days). Document that authorization validity windows should be kept as short as practically possible on fast-block-time chains.

---

## [CHAIN-8] Conflux eSpace Chain ID Not Validated at Runtime
**Severity**: Medium
**Category**: evm-audit-chain-specific
**Location**: `settle()` line 339, constructor
**Description**: The contract emits `block.chainid` in the `PaymentReceived` event but never validates it against an expected value. On Conflux eSpace, the chain ID is 1030 (mainnet) or 71 (testnet). If the same bytecode is deployed on a different chain -- accidentally or maliciously -- all functions execute without error. There is no constructor-time or runtime check that the contract is operating on the intended chain. This compounds the cross-chain replay risk from CHAIN-1: without chain ID validation, the contract cannot distinguish between a legitimate Conflux eSpace deployment and a rogue deployment on another chain.
**Proof of Concept**:
1. Contract bytecode is deployed on Ethereum mainnet (chain ID 1) using the same deployer and nonce.
2. All functions execute normally. Events log chain ID 1 instead of 1030.
3. ERC-3009 authorizations could be valid on both chains if the token's `DOMAIN_SEPARATOR` is compatible.
4. No on-chain mechanism prevents or detects this.
**Recommendation**: Store `block.chainid` as an immutable at construction and validate in `settle()`:
```solidity
uint256 public immutable DEPLOYMENT_CHAIN_ID;

constructor(address[] memory _tokens) Ownable(msg.sender) {
    DEPLOYMENT_CHAIN_ID = block.chainid;
    // ...
}

function settle(...) external nonReentrant {
    require(block.chainid == DEPLOYMENT_CHAIN_ID, "X402: wrong chain");
    // ...
}
```

---

## [CHAIN-9] Native CFX Withdrawal Pattern Compatibility
**Severity**: Low
**Category**: evm-audit-chain-specific
**Location**: `withdrawFees()`
**Description**: The `withdrawFees()` function uses `owner().call{value: balance}("")` to send native CFX to the owner. While the `.call{value}` pattern works on Conflux eSpace (CFX behaves like ETH for transfer purposes), Conflux eSpace has a storage collateral mechanism where certain storage operations require collateral deposits. If the owner is a smart contract (e.g., a multisig or governance contract) whose `receive()` or `fallback()` function triggers storage writes, the call could fail unexpectedly due to insufficient storage collateral, even with sufficient gas. This forwards all available gas to the recipient, which is generally fine but could interact unexpectedly with Conflux-specific storage pricing.
**Proof of Concept**:
1. Owner is set to a multisig contract on Conflux eSpace.
2. `withdrawFees()` is called with collected CFX fees.
3. The `.call{value}` forwards gas to the multisig's `receive()` function.
4. The multisig performs storage operations that require Conflux storage collateral.
5. The call fails with an unexpected error unrelated to gas.
**Recommendation**: Document that the owner address should be an EOA or a contract with a simple `receive()` function. Consider implementing a pull pattern where fees accumulate and the owner claims them via a dedicated function that does not forward arbitrary gas.

---

## [CHAIN-10] Token Activation Timelock Monitoring Must Account for Fast Block Production
**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: `proposeToken()`, `activateToken()`
**Description**: The `TOKEN_ACTIVATION_DELAY` of 48 hours is wall-clock based via `block.timestamp`, so the actual delay is the same regardless of block speed. However, on Conflux eSpace, 48 hours represents approximately 345,600 blocks (vs ~14,400 on Ethereum). Monitoring systems and governance watchers designed for Ethereum's cadence may need reconfiguration. A bot polling every 100 blocks checks every ~50 seconds on Conflux vs ~20 minutes on Ethereum. This is an operational concern: the timelock is adequate, but off-chain infrastructure must be tuned for Conflux's block production rate to ensure malicious token proposals are detected in time.
**Proof of Concept**: N/A -- operational concern, not a contract vulnerability.
**Recommendation**: Document the block speed difference for monitoring infrastructure. Ensure off-chain governance monitoring is configured for Conflux eSpace's ~0.5s block time rather than Ethereum's 12s block time.

---

## [CHAIN-11] No Hardcoded Addresses -- Correct Multi-Chain Portability
**Severity**: Info
**Category**: evm-audit-chain-specific
**Location**: Constructor, token management functions
**Description**: The contract correctly avoids all hardcoded token or infrastructure addresses. Token support is configurable via the constructor and the propose/activate flow. No external protocol addresses (Uniswap, Gnosis Safe, etc.) are referenced. This makes the contract portable across Conflux eSpace testnet (chain 71) and mainnet (chain 1030) without code changes. This is the correct approach for a chain-agnostic deployment.
**Proof of Concept**: N/A -- positive finding.
**Recommendation**: No change needed.
