// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @notice Mock ERC-20 whose permit() always reverts with a string reason.
 *         Used to exercise the `catch Error(string memory reason)` branch in PermitHandler.
 */
contract MockRevertPermitToken {
    function permit(
        address, address, uint256, uint256, uint8, bytes32, bytes32
    ) external pure {
        revert("ERC20Permit: expired deadline");
    }

    function nonces(address) external pure returns (uint256) { return 0; }
    function DOMAIN_SEPARATOR() external pure returns (bytes32) { return bytes32(0); }
}
