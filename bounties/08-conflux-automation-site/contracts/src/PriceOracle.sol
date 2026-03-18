// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracle
 * @notice Simple price oracle for token pairs on Conflux DEXes
 * @dev In production, this would integrate with Swappi/Flux or Chainlink
 */
contract PriceOracle is Ownable {
    
    struct PriceData {
        uint256 price;          // Price in USD (18 decimals)
        uint256 timestamp;      // Last update timestamp
        uint256 confidence;     // Confidence level (0-10000)
    }
    
    // Mapping from token address to price data
    mapping(address => PriceData) public prices;
    
    // Mapping from pair to custom price source
    mapping(bytes32 => address) public priceSources;
    
    // Authorized price updaters
    mapping(address => bool) public updaters;
    
    // Events
    event PriceUpdated(address indexed token, uint256 price, uint256 timestamp);
    event UpdaterAdded(address indexed updater);
    event UpdaterRemoved(address indexed updater);
    
    modifier onlyUpdater() {
        require(updaters[msg.sender] || msg.sender == owner(), "Not authorized updater");
        _;
    }
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Update price for a token
     * @param token Token address
     * @param price New price in USD (18 decimals)
     * @param confidence Confidence level (0-10000)
     */
    function updatePrice(
        address token,
        uint256 price,
        uint256 confidence
    ) external onlyUpdater {
        require(price > 0, "Invalid price");
        require(confidence <= 10000, "Invalid confidence");
        
        prices[token] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence
        });
        
        emit PriceUpdated(token, price, block.timestamp);
    }
    
    /**
     * @notice Get price for a token
     * @param token Token address
     * @return Price in USD (18 decimals)
     */
    function getPrice(address token) external view returns (uint256) {
        PriceData memory data = prices[token];
        require(data.price > 0, "Price not available");
        return data.price;
    }
    
    /**
     * @notice Get price with confidence
     * @param token Token address
     * @return price Price in USD (18 decimals)
     * @return confidence Confidence level (0-10000)
     * @return timestamp Last update timestamp
     */
    function getPriceWithConfidence(address token) external view returns (
        uint256 price,
        uint256 confidence,
        uint256 timestamp
    ) {
        PriceData memory data = prices[token];
        require(data.price > 0, "Price not available");
        return (data.price, data.confidence, data.timestamp);
    }
    
    /**
     * @notice Calculate pair price ratio
     * @param tokenA First token
     * @param tokenB Second token
     * @return Price ratio (how many tokenB per tokenA)
     */
    function getPairPrice(address tokenA, address tokenB) external view returns (uint256) {
        uint256 priceA = prices[tokenA].price;
        uint256 priceB = prices[tokenB].price;
        
        require(priceA > 0 && priceB > 0, "Price not available");
        
        // Return price ratio (tokenA in terms of tokenB)
        return (priceA * 1e18) / priceB;
    }
    
    /**
     * @notice Check if price is fresh (within max age)
     * @param token Token address
     * @param maxAge Maximum age in seconds
     * @return Whether price is fresh
     */
    function isPriceFresh(address token, uint256 maxAge) external view returns (bool) {
        PriceData memory data = prices[token];
        return data.timestamp > 0 && (block.timestamp - data.timestamp) <= maxAge;
    }
    
    // Admin functions
    
    /**
     * @notice Add authorized updater
     * @param updater Updater address
     */
    function addUpdater(address updater) external onlyOwner {
        updaters[updater] = true;
        emit UpdaterAdded(updater);
    }
    
    /**
     * @notice Remove authorized updater
     * @param updater Updater address
     */
    function removeUpdater(address updater) external onlyOwner {
        updaters[updater] = false;
        emit UpdaterRemoved(updater);
    }
    
    /**
     * @notice Batch update prices
     * @param tokens Array of token addresses
     * @param newPrices Array of new prices
     * @param confidences Array of confidence levels
     */
    function batchUpdatePrices(
        address[] calldata tokens,
        uint256[] calldata newPrices,
        uint256[] calldata confidences
    ) external onlyUpdater {
        require(
            tokens.length == newPrices.length && tokens.length == confidences.length,
            "Array length mismatch"
        );
        
        for (uint256 i = 0; i < tokens.length; i++) {
            require(newPrices[i] > 0, "Invalid price");
            require(confidences[i] <= 10000, "Invalid confidence");
            
            prices[tokens[i]] = PriceData({
                price: newPrices[i],
                timestamp: block.timestamp,
                confidence: confidences[i]
            });
            
            emit PriceUpdated(tokens[i], newPrices[i], block.timestamp);
        }
    }
}
