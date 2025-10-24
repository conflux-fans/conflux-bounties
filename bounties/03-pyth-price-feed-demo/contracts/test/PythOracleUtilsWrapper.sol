// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../utils/PythOracleUtils.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PythOracleUtilsWrapper {
    IPyth public immutable pyth;

    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }

    function formatPrice(PythStructs.Price memory priceData) external pure returns (uint256) {
        return PythOracleUtils.formatPrice(priceData);
    }

    function formatPricePublic(PythStructs.Price memory priceData) external pure returns (uint256) {
        return PythOracleUtils.formatPrice(priceData);
    }

    function isPriceReliable(PythStructs.Price memory priceData) external pure returns (bool) {
        return PythOracleUtils.isPriceReliable(priceData);
    }

    function getConfidenceRatio(PythStructs.Price memory priceData) external pure returns (uint256) {
        return PythOracleUtils.getConfidenceRatio(priceData);
    }

    function isPriceStale(PythStructs.Price memory priceData, uint256 maxAge) external view returns (bool) {
        return PythOracleUtils.isPriceStale(priceData, maxAge);
    }

    function getSafePrice(bytes32 priceId) external view returns (int64) {
        return PythOracleUtils.getSafePrice(pyth, priceId);
    }

    function getPriceWithAge(bytes32 priceId, uint256 maxAge) external view returns (int64, uint64) {
        return PythOracleUtils.getPriceWithAge(pyth, priceId, maxAge);
    }

    function getAveragePrice(bytes32[] memory priceIds) external view returns (int64) {
        return PythOracleUtils.getAveragePrice(pyth, priceIds);
    }

    function getPriceDifference(int64 price1, int64 price2) external pure returns (uint256) {
        return PythOracleUtils.getPriceDifference(price1, price2);
    }

    function convertDecimals(uint256 price, uint256 fromDecimals, uint256 toDecimals) external pure returns (uint256) {
        return PythOracleUtils.convertDecimals(price, fromDecimals, toDecimals);
    }
}