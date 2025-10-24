// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PriceConsumer {
    IPyth public immutable pyth;
    
    event PriceFetched(bytes32 indexed priceId, int64 price, uint64 publishTime);
    
    constructor(address pythContract) {
        require(pythContract != address(0), "Invalid Pyth address");
        pyth = IPyth(pythContract);
    }
    
    function getLatestPrice(bytes32 priceId) external view returns (int64 price, uint64 publishTime) {
        PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceId);
        return (priceData.price, uint64(priceData.publishTime));
    }
    
    function getLatestPriceNoOlderThan(bytes32 priceId, uint256 maxAge) 
        external 
        view 
        returns (int64 price, uint64 publishTime) 
    {
        PythStructs.Price memory priceData = pyth.getPriceNoOlderThan(priceId, maxAge);
        return (priceData.price, uint64(priceData.publishTime));
    }
    
    function getFormattedPrice(bytes32 priceId) external view returns (uint256) {
        PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceId);
        
        if (priceData.expo >= 0) {
            return uint256(uint64(priceData.price)) * (10 ** uint32(priceData.expo));
        } else {
            return (uint256(uint64(priceData.price)) * 1e18) / (10 ** uint32(-priceData.expo));
        }
    }
    
    function getBatchPrices(bytes32[] calldata priceIds) 
        external 
        view 
        returns (int64[] memory prices, uint64[] memory timestamps) 
    {
        uint256 length = priceIds.length;
        prices = new int64[](length);
        timestamps = new uint64[](length);
        
        for (uint256 i = 0; i < length; ) {
            PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceIds[i]);
            prices[i] = priceData.price;
            timestamps[i] = uint64(priceData.publishTime);
            
            unchecked { ++i; }
        }
        
        return (prices, timestamps);
    }
    
    function isPriceStale(bytes32 priceId, uint256 maxAge) external view returns (bool) {
        PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceId);
        return (block.timestamp - priceData.publishTime) > maxAge;
    }
}