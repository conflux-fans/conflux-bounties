// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @notice Mock Swappi factory for SwappiPriceAdapter tests.
 *         Returns a configurable pair address to simulate pair-exists / pair-missing paths.
 */
contract MockSwappiFactory {
    address public pairAddress;

    function setPair(address _pair) external { pairAddress = _pair; }

    function getPair(address /*tokenA*/, address /*tokenB*/)
        external
        view
        returns (address)
    {
        return pairAddress;
    }
}
