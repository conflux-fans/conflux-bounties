// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPyth.sol";

/**
 * @title PriceTrigger
 * @notice Contract that executes actions when price reaches a threshold
 */
contract PriceTrigger {
    IPyth public immutable pyth;
    bytes32 public priceId;
    int64 public triggerPrice;
    bool public triggered;
    bool public isAbove; // true = trigger when price >= threshold, false = when <=

    address public owner;

    event PriceTriggered(int64 currentPrice, uint256 timestamp);
    event TriggerCreated(address indexed creator, bytes32 priceId, int64 triggerPrice, bool isAbove);
    event TriggerReset(address indexed admin);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address pythContract, bytes32 _priceId, int64 _triggerPrice, bool _isAbove) {
        pyth = IPyth(pythContract);
        priceId = _priceId;
        triggerPrice = _triggerPrice;
        isAbove = _isAbove;
        owner = msg.sender;

        emit TriggerCreated(msg.sender, _priceId, _triggerPrice, _isAbove);
    }

    /**
     * @notice Check price and execute trigger if condition met
     * @param priceUpdateData Encoded price update from Pyth
     */
    function checkAndTrigger(bytes[] calldata priceUpdateData) external payable {
        require(!triggered, "Already triggered");

        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");

        pyth.updatePriceFeeds{value: msg.value}(priceUpdateData);

        (int64 price,,,,,) = pyth.getPrice(priceId);

        bool conditionMet = isAbove ? (price >= triggerPrice) : (price <= triggerPrice);

        if (conditionMet) {
            triggered = true;
            emit PriceTriggered(price, block.timestamp);
        }
    }

    /**
     * @notice Update trigger parameters (owner only)
     */
    function updateTrigger(int64 newPrice, bool newIsAbove) external onlyOwner {
        triggerPrice = newPrice;
        isAbove = newIsAbove;
    }

    /**
     * @notice Reset trigger (owner only)
     */
    function resetTrigger() external onlyOwner {
        triggered = false;
        emit TriggerReset(msg.sender);
    }

    /**
     * @notice Withdraw any stuck funds (owner only)
     */
    function withdraw() external onlyOwner {
        (bool success,) = payable(owner).call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
}
