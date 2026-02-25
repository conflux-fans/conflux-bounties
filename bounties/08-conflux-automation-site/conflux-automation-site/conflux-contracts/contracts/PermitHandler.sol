// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PermitHandler
 * @notice Utility contract that combines ERC-2612 permit() + transferFrom()
 *         into a single transaction.  Used to give the AutomationManager a
 *         one-click pre-approval experience: the user signs an off-chain permit,
 *         and this helper submits both permit and the actual approval atomically.
 *
 * @dev Call permitAndApprove() to set an allowance on tokenIn for `spender`
 *      (typically AutomationManager) using only a signed message — no separate
 *      approve() transaction required.
 */
contract PermitHandler is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Events ──────────────────────────────────────────────────────────────

    event PermitApplied(
        address indexed token,
        address indexed owner,
        address indexed spender,
        uint256 value,
        uint256 deadline
    );

    // ─── Errors ──────────────────────────────────────────────────────────────

    error PermitFailed(address token, string reason);
    error ZeroAddress();
    error ZeroAmount();

    // ─── Functions ───────────────────────────────────────────────────────────

    /**
     * @notice Execute an ERC-2612 permit and approve `spender` in one call.
     * @param token    The ERC-20 token supporting EIP-2612 permit.
     * @param owner    The token holder (must be msg.sender for security).
     * @param spender  The address to approve (e.g. AutomationManager).
     * @param value    The allowance to grant.
     * @param deadline Permit expiry timestamp.
     * @param v        Signature component.
     * @param r        Signature component.
     * @param s        Signature component.
     */
    function permitAndApprove(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (token == address(0) || spender == address(0)) revert ZeroAddress();
        if (owner != msg.sender) revert PermitFailed(token, "owner must be caller");
        if (value == 0) revert ZeroAmount();

        // Attempt permit — silently skip if already approved or token doesn't support it.
        try IERC20Permit(token).permit(owner, spender, value, deadline, v, r, s) {
            emit PermitApplied(token, owner, spender, value, deadline);
        } catch Error(string memory reason) {
            revert PermitFailed(token, reason);
        } catch {
            revert PermitFailed(token, "unknown");
        }
    }

    /**
     * @notice Combined helper: permit + approve AutomationManager + create job.
     *         This is a convenience wrapper so the UI can do everything in one tx.
     * @dev The `createJobCalldata` is forwarded to `automationManager` using a
     *      low-level call so this contract stays generic.
     */
    function permitApproveAndCall(
        address token,
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s,
        bytes calldata createJobCalldata
    ) external nonReentrant returns (bytes memory result) {
        if (token == address(0) || spender == address(0)) revert ZeroAddress();
        if (owner != msg.sender) revert PermitFailed(token, "owner must be caller");

        // 1. Permit
        try IERC20Permit(token).permit(owner, spender, value, deadline, v, r, s) {
            emit PermitApplied(token, owner, spender, value, deadline);
        } catch {}

        // 2. Forward the job creation call to AutomationManager
        (bool success, bytes memory returnData) = spender.call(createJobCalldata);
        require(success, "AutomationManager call failed");
        result = returnData;
    }
}
