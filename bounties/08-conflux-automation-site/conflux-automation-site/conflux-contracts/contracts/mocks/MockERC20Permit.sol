// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @notice Mintable ERC-20 with EIP-2612 permit support — for PermitHandler tests.
 */
contract MockERC20Permit is ERC20Permit {
    constructor(string memory name, string memory symbol)
        ERC20(name, symbol)
        ERC20Permit(name)
    {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
