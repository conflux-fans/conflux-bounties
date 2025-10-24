// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

library PythOracleUtils {
    uint256 public constant MAX_PRICE_AGE = 15 minutes;
    uint256 public constant MAX_CONFIDENCE_RATIO = 100;
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant STANDARD_DECIMALS = 18;
    
    error PriceTooOld(uint256 age, uint256 maxAge);
    error PriceNotReliable(uint256 confidenceRatio);
    error InvalidPrice(int64 price);
    error InvalidExponent(int32 expo);
    
    function getPriceWithAge(
        IPyth pyth,
        bytes32 priceId,
        uint256 maxAge
    ) internal view returns (int64 price, uint64 publishTime) {
        PythStructs.Price memory priceData = pyth.getPriceNoOlderThan(priceId, maxAge);
        return (priceData.price, uint64(priceData.publishTime));
    }
    
    function getSafePrice(
        IPyth pyth,
        bytes32 priceId
    ) internal view returns (int64 price) {
        PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceId);
        
        uint256 age = block.timestamp - priceData.publishTime;
        if (age > MAX_PRICE_AGE) {
            revert PriceTooOld(age, MAX_PRICE_AGE);
        }
        
        if (priceData.price <= 0) {
            revert InvalidPrice(priceData.price);
        }
        
        if (!isPriceReliable(priceData)) {
            revert PriceNotReliable(getConfidenceRatio(priceData));
        }
        
        return priceData.price;
    }
    
    function formatPrice(
        PythStructs.Price memory priceData
    ) internal pure returns (uint256) {
        if (priceData.price <= 0) {
            revert InvalidPrice(priceData.price);
        }
        
        uint256 basePrice = uint256(uint64(priceData.price));
        
        if (priceData.expo >= 0) {
            return basePrice * (10 ** uint32(priceData.expo));
        } else {
            uint32 absExpo = uint32(-priceData.expo);
            if (absExpo > STANDARD_DECIMALS) {
                return basePrice / (10 ** (absExpo - uint32(STANDARD_DECIMALS)));
            } else {
                return basePrice * (10 ** (uint32(STANDARD_DECIMALS) - absExpo));
            }
        }
    }
    
    function isPriceReliable(
        PythStructs.Price memory priceData
    ) internal pure returns (bool) {
        if (priceData.price <= 0) return false;
        
        uint256 confidenceRatio = (priceData.conf * BASIS_POINTS) / uint64(priceData.price);
        return confidenceRatio <= MAX_CONFIDENCE_RATIO;
    }
    
    function getConfidenceRatio(
        PythStructs.Price memory priceData
    ) internal pure returns (uint256) {
        if (priceData.price <= 0) return type(uint256).max;
        return (priceData.conf * BASIS_POINTS) / uint64(priceData.price);
    }
    
    function isPriceStale(
        PythStructs.Price memory priceData,
        uint256 maxAge
    ) internal view returns (bool) {
        return (block.timestamp - priceData.publishTime) > maxAge;
    }
    
    function getAveragePrice(
        IPyth pyth,
        bytes32[] memory priceIds
    ) internal view returns (int64) {
        require(priceIds.length > 0, "Empty price IDs");
        
        int256 sum = 0;
        for (uint256 i = 0; i < priceIds.length; ) {
            PythStructs.Price memory priceData = pyth.getPriceUnsafe(priceIds[i]);
            sum += priceData.price;
            unchecked { ++i; }
        }
        
        return int64(sum / int256(priceIds.length));
    }
    
    function getPriceDifference(
        int64 price1,
        int64 price2
    ) internal pure returns (uint256) {
        if (price1 <= 0 || price2 <= 0) return type(uint256).max;
        
        uint256 diff = price1 > price2 
            ? uint256(uint64(price1 - price2))
            : uint256(uint64(price2 - price1));
        
        return (diff * BASIS_POINTS) / uint64(price1);
    }
    
    function convertDecimals(
        uint256 price,
        uint256 fromDecimals,
        uint256 toDecimals
    ) internal pure returns (uint256) {
        if (fromDecimals == toDecimals) return price;
        
        if (fromDecimals < toDecimals) {
            return price * (10 ** (toDecimals - fromDecimals));
        } else {
            return price / (10 ** (fromDecimals - toDecimals));
        }
    }
}