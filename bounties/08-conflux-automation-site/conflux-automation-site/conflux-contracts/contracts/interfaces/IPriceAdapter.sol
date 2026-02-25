// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @title IPriceAdapter
 * @notice Interface for on-chain price feeds. Implementations can wrap
 *         Chainlink, Uniswap V3 TWAP, or Swappi spot prices.
 */
interface IPriceAdapter {
    /**
     * @notice Get the current price of tokenIn denominated in tokenOut.
     * @param tokenIn  The token being sold.
     * @param tokenOut The token being bought.
     * @return price   Price scaled by 1e18 (i.e. how many tokenOut wei per tokenIn wei).
     */
    function getPrice(address tokenIn, address tokenOut) external view returns (uint256 price);
}
