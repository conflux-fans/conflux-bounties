# Access Control Security Audit -- X402PaymentVerifier.sol

**Auditor**: Claude Opus 4.6
**Date**: 2026-04-02
**Scope**: Access control checklist review of `X402PaymentVerifier.sol`

---

## Checklist Summary

The contract uses `Ownable2Step` for two-step ownership transfer and explicitly disables `renounceOwnership`. These are strong defensive patterns and are acknowledged as positive design choices.

The following checklist items produced NO findings (clean):
- **Admin can perform token transfers on behalf of users** -- The owner has no function to move escrowed ERC-20 tokens. Settlement requires a valid ERC-3009 signature from the payer; refunds and releases are gated to the recorded recipient. The owner cannot redirect or seize user funds.
- **Total upgradeability** -- The contract is not upgradeable (no proxy pattern, no delegatecall).
- **Pausing that blocks critical user operations** -- There is no pause mechanism.
- **Missing access controls on sensitive functions** -- All state-changing functions have appropriate access checks (`onlyOwner`, `msg.sender == recipient`, etc.).
- **Two-step ownership transfer not implemented** -- Contract inherits `Ownable2Step`. Credit given.
- **Functions operating on other users assume msg.sender is the user** -- `settle()` requires `msg.sender == recipient`; refund functions require `msg.sender == p.recipient`; seller registration uses `msg.sender` as the seller identity. No confusion between caller and parameter.
- **Whitelist bypass via proxy tokens** -- Token addition is timelocked (48 hours). The owner cannot instantly slip in a malicious proxy token to drain funds.
- **No cap on privileged role count** -- There is only one privileged role (owner). No multi-role system exists, so no uncapped role inflation.
- **Renounce ownership can brick contract** -- Explicitly disabled via revert. Credit given.
- **Initializer can be called by anyone on implementation contract** -- Not applicable; the contract is not upgradeable and uses a constructor, not an initializer.
- **When all agents are the same person** -- The protocol separates payer (signs ERC-3009 auth), seller/recipient (calls `settle`), and owner (admin). A single entity controlling both seller and owner roles could deactivate competing sellers but cannot steal user funds.

---

## Findings

## [AC-1] Registration fee change takes effect instantly without timelock
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `setRegistrationFee()` (line 505)
**Description**: The owner can change the registration fee instantly via `setRegistrationFee()`. Unlike token additions which have a 48-hour timelock, the registration fee has no delay. A compromised or malicious owner could front-run a seller's `registerSeller()` transaction by setting the fee to an extremely high value, extracting excess CFX, then resetting it. While the economic impact is bounded (sellers can choose not to register), the inconsistency with the token timelock pattern suggests this was an oversight.
**Proof of Concept**:
1. Seller submits `registerSeller()` with `msg.value = 0.1 CFX` (current fee).
2. Owner front-runs with `setRegistrationFee(100 ether)`.
3. Seller's transaction reverts ("insufficient registration fee").
4. Alternatively, if the seller sent excess CFX anticipating fee changes, the owner captures the surplus since `registerSeller` only checks `>=` and does not refund overpayment.
**Recommendation**: Either add a timelock to fee changes (consistent with the token activation pattern) or refund excess `msg.value` in `registerSeller()` and `reactivateSeller()`. At minimum, refund overpayment:
```solidity
function registerSeller(...) external payable {
    ...
    require(msg.value >= registrationFee, "X402: insufficient registration fee");
    uint256 excess = msg.value - registrationFee;
    if (excess > 0) {
        (bool sent, ) = msg.sender.call{value: excess}("");
        require(sent, "X402: refund failed");
    }
    ...
}
```

## [AC-2] Corrupted owner can grief the protocol by removing all supported tokens
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `removeToken()` (line 495)
**Description**: While the owner cannot steal user funds, a compromised owner can instantly remove all supported tokens via `removeToken()`, preventing any new settlements. Existing escrows are unaffected (funds can still be released/refunded), but the protocol is effectively frozen for new business. Token removal is instant (no timelock), unlike token addition which has a 48-hour delay. This asymmetry means a compromised owner can deny service faster than the community can react.
**Proof of Concept**:
1. Owner calls `removeToken(USDC)`, `removeToken(USDT0)`, `removeToken(AxCNH)` in a single transaction (via multicall or sequential calls).
2. All subsequent `settle()` calls revert with "X402: unsupported token".
3. Re-adding tokens requires 48 hours (propose + activate), during which the protocol is non-functional.
**Recommendation**: Consider adding a timelock to token removal as well, or implement a multisig/governance requirement for destructive admin actions. Alternatively, document this as an accepted trust assumption.

## [AC-3] Owner can deactivate any seller without notice or appeal
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `deactivateSeller()` (line 234)
**Description**: The owner can call `deactivateSeller(wallet)` for any active seller. This immediately removes them from the active seller list, preventing them from settling new payments. While this is a reasonable admin function for removing bad actors, there is no timelock, no on-chain reason, and no appeal mechanism. A compromised owner could selectively deactivate sellers to disrupt the protocol. Notably, existing escrows for deactivated sellers are not affected -- funds can still be released or refunded.
**Proof of Concept**:
1. Owner calls `deactivateSeller(legitimateSeller)`.
2. Legitimate seller can no longer call `settle()` (it requires `sellers[recipient].active`).
3. Seller must call `reactivateSeller()` and pay the registration fee again to resume operations.
**Recommendation**: This is likely an intentional design choice for moderation. Consider adding an event field for the deactivation reason, or a grace period before deactivation takes effect, to improve transparency. At minimum, document this trust assumption clearly.

## [AC-4] Roles granted in constructor not documented in NatSpec
**Severity**: Info
**Category**: evm-audit-access-control
**Location**: `constructor()` (line 147)
**Description**: The constructor sets `msg.sender` as the owner (via `Ownable(msg.sender)`) and bootstraps the initial set of supported tokens. While the ownership assignment is standard OpenZeppelin behavior, the NatSpec documentation does not explicitly state that the deployer becomes the owner with the ability to manage tokens, set fees, deactivate sellers, and withdraw collected fees. For a multi-tenant payment protocol, the trust assumptions around the owner role should be explicitly documented.
**Proof of Concept**: N/A -- informational.
**Recommendation**: Add NatSpec to the constructor and contract-level documentation explicitly listing the owner's privileges:
```solidity
/**
 * @param _tokens Initial supported ERC-3009 token addresses
 * @dev The deployer (msg.sender) becomes the contract owner with privileges to:
 *      - Propose/activate/remove supported tokens
 *      - Set and update the seller registration fee
 *      - Deactivate any seller
 *      - Withdraw collected registration fees (native CFX only)
 *      The owner CANNOT move escrowed ERC-20 tokens or redirect payments.
 */
```

## [AC-5] No excess registration fee refund enables extraction from overpaying sellers
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `registerSeller()` (line 170), `reactivateSeller()` (line 195)
**Description**: Both `registerSeller()` and `reactivateSeller()` use `require(msg.value >= registrationFee)` but do not refund any excess CFX sent. Combined with the instant fee change in AC-1, this creates a scenario where a seller who sends excess ETH (as a buffer against fee changes) loses the surplus permanently. Even without malicious owner behavior, a simple user mistake of sending too much CFX results in permanent loss of funds that the owner can later `withdrawFees()`.
**Proof of Concept**:
1. Registration fee is 0.1 CFX.
2. Seller calls `registerSeller{value: 1 CFX}(...)` (overpays by 0.9 CFX).
3. The 0.9 CFX excess is trapped in the contract.
4. Owner calls `withdrawFees()` and receives the full 1 CFX balance.
**Recommendation**: Refund excess `msg.value` to the caller in both `registerSeller()` and `reactivateSeller()`, as shown in AC-1's recommendation.

---

## Summary

| ID   | Title                                              | Severity |
|------|----------------------------------------------------|----------|
| AC-1 | Registration fee change without timelock           | Low      |
| AC-2 | Corrupted owner can remove all tokens instantly    | Low      |
| AC-3 | Owner can deactivate any seller without notice     | Low      |
| AC-4 | Constructor role grants not documented in NatSpec   | Info     |
| AC-5 | No excess registration fee refund                  | Low      |

**Overall Assessment**: The contract demonstrates strong access control fundamentals: `Ownable2Step` for safe ownership transfer, `renounceOwnership` disabled to prevent bricking, timelocked token additions, and clear separation between owner privileges and user fund custody. The owner explicitly cannot touch escrowed ERC-20 tokens. Findings are Low/Info severity, focused on inconsistent use of timelocks across admin functions and missing overpayment refunds. No Critical or High severity access control issues were identified.
