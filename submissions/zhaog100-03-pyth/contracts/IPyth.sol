// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPyth {
    function getPrice(bytes32 id) external view returns (
        int64 price,
        uint64 conf,
        int32 expo,
        uint256 publishTime,
        uint64 emaPrice,
        uint64 emaConf
    );

    function getPriceUnsafe(bytes32 id) external view returns (
        int64 price,
        uint64 conf,
        int32 expo,
        uint256 publishTime,
        uint64 emaPrice,
        uint64 emaConf
    );

    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 fee);

    function updatePriceFeeds(bytes[] calldata updateData) external payable;
}
