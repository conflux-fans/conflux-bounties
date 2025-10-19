// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DynamicFeeManager
 * @notice Manages dynamic fees based on price volatility
 */
contract DynamicFeeManager is Ownable {
    IPyth public immutable pyth;
    
    struct FeeConfig {
        uint256 baseFee;
        uint256 lowThreshold;
        uint256 highThreshold;
        uint256 lowVolatilityFee;
        uint256 highVolatilityFee;
    }
    
    mapping(bytes32 => FeeConfig) public feeConfigs;
    uint256 private constant BASIS_POINTS = 10000;
    
    event FeeConfigured(bytes32 indexed priceId, uint256 baseFee);
    
    constructor(address pythContract) Ownable(msg.sender) {
        require(pythContract != address(0), "Invalid Pyth address");
        pyth = IPyth(pythContract);
    }
    
    function configureFee(
        bytes32 priceId,
        uint256 baseFee,
        uint256 lowThreshold,
        uint256 highThreshold,
        uint256 lowVolatilityFee,
        uint256 highVolatilityFee
    ) external onlyOwner {
        require(baseFee <= BASIS_POINTS, "Base fee too high");
        require(lowVolatilityFee <= BASIS_POINTS, "Low volatility fee too high");
        require(highVolatilityFee <= BASIS_POINTS, "High volatility fee too high");
        require(lowThreshold < highThreshold, "Invalid thresholds");
        
        feeConfigs[priceId] = FeeConfig({
            baseFee: baseFee,
            lowThreshold: lowThreshold,
            highThreshold: highThreshold,
            lowVolatilityFee: lowVolatilityFee,
            highVolatilityFee: highVolatilityFee
        });
        
        emit FeeConfigured(priceId, baseFee);
    }
    
    /**
     * @notice Calculate fee based on current price volatility (view function)
     * @param priceId Pyth price feed ID
     * @param amount Amount to calculate fee on
     * @return fee The calculated fee
     */
    function calculateFee(bytes32 priceId, uint256 amount) external view returns (uint256 fee) {
        FeeConfig memory config = feeConfigs[priceId];
        require(config.baseFee > 0, "Fee not configured");
        
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);
        uint256 currentPrice = uint256(uint64(price.price));
        
        uint256 feeRate;
        
        if (currentPrice < config.lowThreshold || currentPrice > config.highThreshold) {
            feeRate = config.highVolatilityFee;
        } else {
            feeRate = config.baseFee;
        }
        
        fee = (amount * feeRate) / BASIS_POINTS;
    }
    
    /**
     * @notice Get the current fee rate for a price feed
     * @param priceId Pyth price feed ID
     * @return feeRate The current fee rate in basis points
     */
    function getCurrentFeeRate(bytes32 priceId) external view returns (uint256 feeRate) {
        FeeConfig memory config = feeConfigs[priceId];
        require(config.baseFee > 0, "Fee not configured");
        
        PythStructs.Price memory price = pyth.getPriceUnsafe(priceId);
        uint256 currentPrice = uint256(uint64(price.price));
        
        if (currentPrice < config.lowThreshold || currentPrice > config.highThreshold) {
            feeRate = config.highVolatilityFee;
        } else {
            feeRate = config.baseFee;
        }
    }
}