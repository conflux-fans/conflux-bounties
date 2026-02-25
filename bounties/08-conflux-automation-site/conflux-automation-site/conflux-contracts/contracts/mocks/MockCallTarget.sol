// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/**
 * @notice Generic call target used to test PermitHandler.permitApproveAndCall.
 *         Can be configured to succeed or fail so both branches of the downstream
 *         call are exercised.
 */
contract MockCallTarget {
    bool public shouldFail;
    bytes public lastCalldata;

    function setShouldFail(bool _fail) external { shouldFail = _fail; }

    fallback() external payable {
        require(!shouldFail, "MockCallTarget: forced failure");
        lastCalldata = msg.data;
    }

    receive() external payable {}
}
