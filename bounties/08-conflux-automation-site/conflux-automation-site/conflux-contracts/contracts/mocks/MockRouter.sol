// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice Minimal mock DEX router for testing on-chain execution flows.
 *
 *  The AutomationManager pulls tokenIn to itself, approves this router, then
 *  calls router.call(swapCalldata).  This mock:
 *   1. Transfers tokenIn FROM the caller (AutomationManager) to itself.
 *   2. Transfers exactly `amountOut` of tokenOut FROM its own balance TO `recipient`.
 *
 *  Pre-condition: the test must mint tokenOut to this contract address before the call.
 */
contract MockRouter {
    /**
     * @param tokenIn   Token the AutomationManager has transferred to itself and approved here.
     * @param tokenOut  Token this router will send to the recipient.
     * @param amountIn  Amount of tokenIn to pull from msg.sender (the AutomationManager).
     * @param recipient Address that should receive tokenOut (the job owner).
     * @param amountOut Amount of tokenOut to send to recipient.
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address recipient,
        uint256 amountOut
    ) external {
        // Pull tokenIn from the AutomationManager (which has already approved us)
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        // Send tokenOut to recipient from this contract's balance
        IERC20(tokenOut).transfer(recipient, amountOut);
    }
}
