// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract FallbackOracle is Ownable {
    IPyth public immutable primaryOracle;
    
    mapping(bytes32 => bool) public fallbackMode;
    mapping(bytes32 => int64) public fallbackPrices;
    mapping(address => bool) public trustedUpdaters;
    
    event FallbackModeEntered(bytes32 indexed priceId);
    event FallbackModeExited(bytes32 indexed priceId);
    event FallbackPriceUpdated(bytes32 indexed priceId, int64 price);
    event TrustedUpdaterAdded(address indexed updater);
    event TrustedUpdaterRemoved(address indexed updater);
    
    modifier onlyTrustedUpdater() {
        require(trustedUpdaters[msg.sender], "Not a trusted updater");
        _;
    }
    
    constructor(address pythContract) Ownable(msg.sender) {
        require(pythContract != address(0), "Invalid Pyth address");
        primaryOracle = IPyth(pythContract);
    }
    
    function addTrustedUpdater(address updater) external onlyOwner {
        require(updater != address(0), "Invalid updater");
        trustedUpdaters[updater] = true;
        emit TrustedUpdaterAdded(updater);
    }
    
    function removeTrustedUpdater(address updater) external onlyOwner {
        trustedUpdaters[updater] = false;
        emit TrustedUpdaterRemoved(updater);
    }
    
    function enterFallbackMode(bytes32 priceId) external onlyOwner {
        fallbackMode[priceId] = true;
        emit FallbackModeEntered(priceId);
    }
    
    function exitFallbackMode(bytes32 priceId) external onlyOwner {
        fallbackMode[priceId] = false;
        emit FallbackModeExited(priceId);
    }
    
    function updateFallbackPrice(bytes32 priceId, int64 price) external onlyTrustedUpdater {
        require(fallbackMode[priceId], "Not in fallback mode");
        require(price > 0, "Invalid price");
        fallbackPrices[priceId] = price;
        emit FallbackPriceUpdated(priceId, price);
    }
    
    function getPrice(bytes32 priceId) external view returns (int64 price) {
        if (fallbackMode[priceId]) {
            price = fallbackPrices[priceId];
            require(price > 0, "Fallback price not set");
        } else {
            PythStructs.Price memory priceData = primaryOracle.getPriceUnsafe(priceId);
            price = priceData.price;
        }
    }
    
    function isInFallbackMode(bytes32 priceId) external view returns (bool) {
        return fallbackMode[priceId];
    }
}