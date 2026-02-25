// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @notice Mock ERC-20 whose permit() reverts with a custom error (no string).
 *         Used to exercise the bare `catch {}` branch in PermitHandler.
 */
contract MockPanicPermitToken {
    error PermitError();

    function permit(
        address, address, uint256, uint256, uint8, bytes32, bytes32
    ) external pure {
        revert PermitError();
    }

    function nonces(address) external pure returns (uint256) { return 0; }
    function DOMAIN_SEPARATOR() external pure returns (bytes32) { return bytes32(0); }
}
