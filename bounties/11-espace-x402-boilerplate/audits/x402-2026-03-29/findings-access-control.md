# Access Control Audit Findings

**Contracts**: `X402PaymentVerifier.sol`, `MockUSDT0.sol`
**Date**: 2026-03-29
**Category**: evm-audit-access-control

---

## [AC-1] Owner can force refunds without recipient consent, acting as admin transfer
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `refund()` in X402PaymentVerifier.sol
**Description**: The `refund()` function allows `owner()` to trigger a refund for any invoice without the recipient's consent. Because refund calls `safeTransferFrom(recipient, payer, amount)`, the owner can force a token transfer out of the recipient's balance (assuming the contract has approval). This means the owner effectively has the ability to perform token transfers on behalf of users (the recipient). If the recipient has granted the verifier contract a token allowance, the owner can drain that allowance back to the payer at any time, even if the recipient considers the payment legitimately settled.
**Proof of Concept**:
1. Payer settles an invoice, funds transfer to recipient via `transferWithAuthorization`.
2. Recipient grants the `X402PaymentVerifier` contract an ERC-20 allowance (e.g., to facilitate future refunds they intend to control).
3. Owner calls `refund(invoiceId)` without recipient's permission, pulling funds from recipient back to payer.
**Recommendation**: Remove owner from the refund authorization, or require a two-party confirmation (e.g., recipient must sign or pre-approve a specific refund). At minimum, document this trust assumption prominently.
```solidity
// Option A: Remove owner override
require(msg.sender == p.recipient, "X402: not authorized to refund");

// Option B: Two-step refund with recipient approval
mapping(bytes32 => bool) public refundApproved;
function approveRefund(bytes32 invoiceId) external {
    require(msg.sender == payments[invoiceId].recipient, "X402: not recipient");
    refundApproved[invoiceId] = true;
}
function refund(bytes32 invoiceId) external nonReentrant {
    require(refundApproved[invoiceId], "X402: refund not approved");
    // ... rest of refund logic
}
```

---

## [AC-2] Instant parameter changes without timelock on token support
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `setSupportedToken()` in X402PaymentVerifier.sol
**Description**: The owner can instantly add or remove supported tokens via `setSupportedToken()` with no timelock or delay. Removing a token instantly prevents all future settlements for that token. Any in-flight `transferWithAuthorization` signatures that users have already prepared for a token that gets delisted will revert, causing a denial of service for those pending payments. There is no grace period for users to complete existing authorized transactions.
**Proof of Concept**:
1. A payer prepares and signs a `transferWithAuthorization` for USDT0.
2. Before the `settle()` transaction is mined, the owner calls `setSupportedToken(USDT0, false)`.
3. The payer's `settle()` call reverts with "X402: unsupported token".
**Recommendation**: Introduce a timelock (e.g., 24-48 hours) before token delisting takes effect, or allow in-flight settlements for recently delisted tokens.
```solidity
mapping(address => uint256) public tokenDelistTime;

function setSupportedToken(address token, bool supported) external onlyOwner {
    require(token != address(0), "X402: zero token address");
    if (!supported) {
        tokenDelistTime[token] = block.timestamp + 24 hours;
    } else {
        supportedTokens[token] = true;
        tokenDelistTime[token] = 0;
    }
}

// In settle(), check: require(supportedTokens[token] && (tokenDelistTime[token] == 0 || block.timestamp < tokenDelistTime[token]), ...);
```

---

## [AC-3] Corrupted owner can permanently disrupt the protocol
**Severity**: Medium
**Category**: evm-audit-access-control
**Location**: `setSupportedToken()`, `deactivateSeller()`, `refund()` in X402PaymentVerifier.sol
**Description**: A compromised or malicious owner can cause significant protocol damage through multiple vectors: (1) delist all supported tokens, bricking all future settlements; (2) deactivate every registered seller; (3) force refunds on all paid invoices (given sufficient allowance). There is no multisig requirement, no timelock, and no emergency governance to counteract a rogue owner. The contract uses `Ownable2Step` which mitigates accidental transfers, but does not mitigate a compromised key.
**Proof of Concept**:
1. Owner key is compromised.
2. Attacker calls `setSupportedToken(token, false)` for every supported token.
3. Attacker calls `deactivateSeller(wallet)` for every active seller.
4. Attacker calls `refund(invoiceId)` for every paid invoice where the recipient has granted allowance.
5. Protocol is fully bricked and funds are reversed.
**Recommendation**: Use a multisig (e.g., Gnosis Safe) as the owner. Consider adding role separation so that no single key can both delist tokens and force refunds. For production, implement a governance module or DAO-controlled ownership.

---

## [AC-4] Missing access control on MockUSDT0 mint function
**Severity**: Critical
**Category**: evm-audit-access-control
**Location**: `mint()` in MockUSDT0.sol
**Description**: The `mint()` function has no access control -- any address can mint an arbitrary amount of USDT0 tokens to any address. While this is clearly a mock/test contract, if deployed to a live network (even a testnet used for integration testing), any user can mint unlimited tokens and use them to interact with `X402PaymentVerifier`, undermining any meaningful testing of the payment flow's economic constraints.
**Proof of Concept**:
1. Any external account calls `MockUSDT0.mint(attackerAddress, 1_000_000e6)`.
2. Attacker now holds 1,000,000 USDT0 and can use them in `settle()` calls.
**Recommendation**: If intended only for testing, add an `onlyOwner` modifier or a minter role. If this contract must never be deployed to production, add a prominent comment and ensure deploy scripts prevent it.
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDT0 is ERC20, Ownable {
    constructor() ERC20("USD Tether 0", "USDT0") Ownable(msg.sender) {}
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
```

---

## [AC-5] Renouncing ownership bricks admin functions permanently
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: Inherited from `Ownable2Step` (OpenZeppelin) in X402PaymentVerifier.sol
**Description**: `Ownable2Step` inherits from `Ownable`, which exposes `renounceOwnership()`. If the owner calls `renounceOwnership()`, all `onlyOwner` functions (`setSupportedToken`) become permanently inaccessible. The owner also loses the ability to force refunds or deactivate sellers via the owner path. The supported token list becomes immutable, with no way to add tokens or remove compromised ones.
**Proof of Concept**:
1. Owner calls `renounceOwnership()`.
2. `setSupportedToken()` can never be called again.
3. If a supported token is exploited or paused, there is no way to delist it.
**Recommendation**: Override `renounceOwnership()` to revert, preventing accidental use.
```solidity
function renounceOwnership() public pure override {
    revert("X402: renounce disabled");
}
```

---

## [AC-6] settle() operates on behalf of `from` without verifying msg.sender relationship
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `settle()` in X402PaymentVerifier.sol
**Description**: The `settle()` function accepts a `from` parameter and executes `transferWithAuthorization` on their behalf. Any caller can submit a settlement for any `from` address, provided they have the valid ERC-3009 signature (v, r, s). The function does not verify that `msg.sender == from` or that `msg.sender` is an authorized relayer. While ERC-3009 itself provides signature-based authorization (so the `from` address must have signed), this means anyone who observes a valid signature in the mempool can front-run and submit the settlement themselves, potentially associating it with a different `invoiceId` or `endpoint` than the original submitter intended.
**Proof of Concept**:
1. Legitimate relayer submits a `settle()` transaction to the mempool.
2. An attacker observes the pending transaction and extracts the ERC-3009 signature parameters.
3. Attacker front-runs with a `settle()` call using the same signature but a different `invoiceId` or `endpoint` string.
4. The original transaction reverts because the ERC-3009 nonce is now used.
**Recommendation**: Consider binding the `invoiceId` and `endpoint` into the authorization signature, or verify that `msg.sender` is an authorized facilitator. At minimum, document that the `invoiceId` and `endpoint` fields are caller-asserted metadata and not cryptographically bound to the payer's intent.

---

## [AC-7] Roles granted in constructor not documented
**Severity**: Info
**Category**: evm-audit-access-control
**Location**: `constructor()` in X402PaymentVerifier.sol
**Description**: The constructor grants `msg.sender` the owner role via `Ownable(msg.sender)` and populates the initial supported token list. These are the only privileged roles in the system. While straightforward, the constructor parameters and the resulting privilege setup are not documented in NatSpec or comments. For a contract handling payments, the trust model (what the owner can do) should be clearly documented for integrators and auditors.
**Recommendation**: Add NatSpec documentation to the constructor and contract describing the owner's privileges: token management, seller deactivation, and refund authorization.

---

## [AC-8] No mechanism to reactivate a deactivated seller
**Severity**: Low
**Category**: evm-audit-access-control
**Location**: `deactivateSeller()`, `registerSeller()` in X402PaymentVerifier.sol
**Description**: Once a seller is deactivated (by themselves or by the owner), they cannot re-register because `registerSeller()` checks `!sellers[msg.sender].active` but the seller struct still exists with `active == false`. The `registerSeller()` require statement `!sellers[msg.sender].active` passes, but the seller's address is pushed to `sellerList` again, creating a duplicate entry. This is not strictly an access control bypass, but the owner has no `reactivateSeller()` function, and the duplicate entry in `sellerList` will cause `getActiveSellers()` to return duplicates if the seller re-registers and is active again.
**Proof of Concept**:
1. Seller registers, then deactivates.
2. Seller calls `registerSeller()` again -- the `active` check passes since it is false.
3. Seller's address is pushed to `sellerList` a second time.
4. `getActiveSellers()` now returns this seller twice.
**Recommendation**: Add an explicit `reactivateSeller()` function, or check whether the seller struct already exists (e.g., `registeredAt > 0`) before pushing to `sellerList`.
```solidity
function registerSeller(string calldata apiBaseUrl, string calldata description) external {
    require(bytes(apiBaseUrl).length > 0, "X402: empty API URL");
    require(sellers[msg.sender].registeredAt == 0, "X402: already registered");
    sellers[msg.sender] = Seller({ wallet: msg.sender, apiBaseUrl: apiBaseUrl, description: description, active: true, registeredAt: block.timestamp });
    sellerList.push(msg.sender);
}

function reactivateSeller() external {
    require(sellers[msg.sender].registeredAt > 0, "X402: not registered");
    require(!sellers[msg.sender].active, "X402: already active");
    sellers[msg.sender].active = true;
}
```
