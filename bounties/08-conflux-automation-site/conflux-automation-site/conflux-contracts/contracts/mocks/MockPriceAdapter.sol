// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "../interfaces/IPriceAdapter.sol";

/**
 * @notice Minimal mock price adapter for testing. Always returns a fixed price.
 */
contract MockPriceAdapter is IPriceAdapter {
    uint256 public fixedPrice = 1e18; // 1:1 by default

    function setPrice(uint256 _price) external {
        fixedPrice = _price;
    }

    function getPrice(address, address) external view override returns (uint256) {
        return fixedPrice;
    }
}
