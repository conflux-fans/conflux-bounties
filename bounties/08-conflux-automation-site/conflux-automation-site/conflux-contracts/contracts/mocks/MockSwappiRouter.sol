// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @notice Mock Swappi router for SwappiPriceAdapter tests.
 *         Returns a configurable price or reverts to exercise all branches in getPrice().
 */
contract MockSwappiRouter {
    uint256 public priceOut = 1e18;
    bool public shouldRevert;

    function setPrice(uint256 _price) external { priceOut = _price; }
    function setShouldRevert(bool _revert) external { shouldRevert = _revert; }

    function getAmountsOut(uint256 /*amountIn*/, address[] calldata /*path*/)
        external
        view
        returns (uint256[] memory amounts)
    {
        require(!shouldRevert, "MockSwappiRouter: forced revert");
        amounts = new uint256[](2);
        amounts[0] = 1e18;
        amounts[1] = priceOut;
    }
}
