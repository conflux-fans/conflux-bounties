// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPyth.sol";

/**
 * @title PriceConsumer
 * @notice Basic contract that reads price data from Pyth oracle
 * @dev Demonstrates how to consume Pyth price feeds on Conflux eSpace
 */
contract PriceConsumer {
    IPyth public immutable pyth;

    // Price feed IDs for supported assets
    bytes32 public btcPriceId;
    bytes32 public ethPriceId;
    bytes32 public cfxPriceId;
    bytes32 public usdcPriceId;

    // Maximum age for price data (5 minutes)
    uint256 public constant MAX_PRICE_AGE = 300 seconds;
    // Maximum confidence interval factor (reject if conf > price * factor)
    uint256 public constant MAX_CONF_FACTOR = 2;

    event PriceFetched(bytes32 indexed priceId, int64 price, uint256 timestamp);

    error PriceStale(uint256 publishTime);
    error ConfidenceTooLow(int64 price, uint64 conf);
    error InvalidPriceFeed(bytes32 priceId);

    constructor(
        address pythContract,
        bytes32 _btcPriceId,
        bytes32 _ethPriceId,
        bytes32 _cfxPriceId,
        bytes32 _usdcPriceId
    ) {
        pyth = IPyth(pythContract);
        btcPriceId = _btcPriceId;
        ethPriceId = _ethPriceId;
        cfxPriceId = _cfxPriceId;
        usdcPriceId = _usdcPriceId;
    }

    /**
     * @notice Get the latest price for a given price feed ID with validation
     * @param priceId The Pyth price feed ID
     * @return price The current price
     * @return conf The confidence interval
     * @return expo The price exponent
     */
    function getValidatedPrice(bytes32 priceId) public view returns (
        int64 price, uint64 conf, int32 expo
    ) {
        if (priceId != btcPriceId && priceId != ethPriceId &&
            priceId != cfxPriceId && priceId != usdcPriceId) {
            revert InvalidPriceFeed(priceId);
        }

        (price, conf, expo, uint256 publishTime,,) = pyth.getPrice(priceId);

        if (block.timestamp - publishTime > MAX_PRICE_AGE) {
            revert PriceStale(publishTime);
        }

        if (price > 0 && uint64(conf) > uint64(price) * MAX_CONF_FACTOR) {
            revert ConfidenceTooLow(price, conf);
        }

        emit PriceFetched(priceId, price, block.timestamp);
    }

    /**
     * @notice Get BTC price with validation
     */
    function getBtcPrice() external view returns (int64, uint64, int32) {
        return getValidatedPrice(btcPriceId);
    }

    /**
     * @notice Get ETH price with validation
     */
    function getEthPrice() external view returns (int64, uint64, int32) {
        return getValidatedPrice(ethPriceId);
    }

    /**
     * @notice Get CFX price with validation
     */
    function getCfxPrice() external view returns (int64, uint64, int32) {
        return getValidatedPrice(cfxPriceId);
    }

    /**
     * @notice Get the ratio between two prices
     */
    function getPriceRatio(bytes32 baseId, bytes32 quoteId) external view returns (int256) {
        (int64 basePrice,,,,,) = pyth.getPrice(baseId);
        (int64 quotePrice,,,,,) = pyth.getPrice(quoteId);

        if (quotePrice == 0) revert("Quote price is zero");

        return (int256(basePrice) * 1e18) / int256(quotePrice);
    }
}
