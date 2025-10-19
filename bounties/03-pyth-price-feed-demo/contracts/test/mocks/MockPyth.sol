// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MockPyth is IPyth {
    mapping(bytes32 => PythStructs.Price) private prices;
    
    function setMockPrice(
        bytes32 id,
        int64 price,
        uint64 conf,
        int32 expo,
        uint publishTime
    ) external {
        prices[id] = PythStructs.Price({
            price: price,
            conf: conf,
            expo: expo,
            publishTime: publishTime
        });
    }
    
    function getPriceUnsafe(bytes32 id) external view override returns (PythStructs.Price memory) {
        return prices[id];
    }
    
    function getPriceNoOlderThan(bytes32 id, uint age) external view override returns (PythStructs.Price memory) {
        PythStructs.Price memory price = prices[id];
        require(block.timestamp - price.publishTime <= age, "Price too old");
        return price;
    }
    
    function getPrice(bytes32) external pure override returns (PythStructs.Price memory) {
        revert("Not implemented");
    }
    
    function getEmaPrice(bytes32) external pure override returns (PythStructs.Price memory) {
        revert("Not implemented");
    }
    
    function getEmaPriceUnsafe(bytes32) external pure override returns (PythStructs.Price memory) {
        revert("Not implemented");
    }
    
    function getEmaPriceNoOlderThan(bytes32, uint) external pure override returns (PythStructs.Price memory) {
        revert("Not implemented");
    }
    
    function updatePriceFeeds(bytes[] calldata) external payable override {}
    
    function updatePriceFeedsIfNecessary(bytes[] calldata, bytes32[] calldata, uint64[] calldata) external payable override {}
    
    function getUpdateFee(bytes[] calldata) external pure override returns (uint) {
        return 0;
    }
    
    function parsePriceFeedUpdates(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory) {
        revert("Not implemented");
    }
    
    function parsePriceFeedUpdatesUnique(
        bytes[] calldata,
        bytes32[] calldata,
        uint64,
        uint64
    ) external payable override returns (PythStructs.PriceFeed[] memory) {
        revert("Not implemented");
    }
    
    function getValidTimePeriod() external pure override returns (uint) {
        return 60;
    }
}