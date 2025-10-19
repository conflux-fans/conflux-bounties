// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MockLendingProtocol is ReentrancyGuard {
    IPyth public immutable pyth;
    
    struct Position {
        address borrower;
        bytes32 collateralAsset;
        bytes32 borrowAsset;
        uint256 collateralAmount;
        uint256 borrowAmount;
        uint256 openTime;
        bool active;
    }
    
    mapping(uint256 => Position) public positions;
    mapping(address => uint256[]) private userPositions;
    uint256 public nextPositionId = 1;
    uint256 public constant LIQUIDATION_THRESHOLD = 15000;
    uint256 public constant LIQUIDATION_BONUS = 500;
    uint256 private constant BASIS_POINTS = 10000;
    
    event PositionOpened(
        uint256 indexed positionId, 
        address indexed borrower, 
        uint256 collateralAmount, 
        uint256 borrowAmount
    );
    event PositionRepaid(uint256 indexed positionId, address indexed borrower);
    event PositionLiquidated(
        uint256 indexed positionId, 
        address indexed liquidator, 
        address indexed borrower
    );
    
    constructor(address pythContract) {
        require(pythContract != address(0), "Invalid Pyth address");
        pyth = IPyth(pythContract);
    }
    
    function openPosition(
        bytes32 collateralAsset,
        bytes32 borrowAsset,
        uint256 borrowAmount
    ) external payable nonReentrant returns (uint256 positionId) {
        require(msg.value > 0, "No collateral provided");
        require(borrowAmount > 0, "Invalid borrow amount");
        require(address(this).balance >= borrowAmount, "Insufficient liquidity");
        
        positionId = nextPositionId++;
        
        positions[positionId] = Position({
            borrower: msg.sender,
            collateralAsset: collateralAsset,
            borrowAsset: borrowAsset,
            collateralAmount: msg.value,
            borrowAmount: borrowAmount,
            openTime: block.timestamp,
            active: true
        });
        
        userPositions[msg.sender].push(positionId);
        
        (bool success, ) = payable(msg.sender).call{value: borrowAmount}("");
        require(success, "Transfer failed");
        
        emit PositionOpened(positionId, msg.sender, msg.value, borrowAmount);
    }
    
    function getHealthRatio(uint256 positionId) public view returns (uint256 healthRatio) {
        Position memory position = positions[positionId];
        require(position.active, "Position not active");
        
        PythStructs.Price memory collateralPrice = pyth.getPriceUnsafe(position.collateralAsset);
        PythStructs.Price memory borrowPrice = pyth.getPriceUnsafe(position.borrowAsset);
        
        uint256 collateralValue = position.collateralAmount * uint256(uint64(collateralPrice.price));
        uint256 borrowValue = position.borrowAmount * uint256(uint64(borrowPrice.price));
        
        if (borrowValue == 0) return type(uint256).max;
        
        healthRatio = (collateralValue * BASIS_POINTS) / borrowValue;
    }
    
    function liquidate(uint256 positionId) external nonReentrant {
        Position storage position = positions[positionId];
        require(position.active, "Position not active");
        
        uint256 healthRatio = getHealthRatio(positionId);
        require(healthRatio < LIQUIDATION_THRESHOLD, "Position is healthy");
        
        uint256 bonus = (position.collateralAmount * LIQUIDATION_BONUS) / BASIS_POINTS;
        uint256 liquidatorReward = position.collateralAmount + bonus;
        
        position.active = false;
        
        (bool success, ) = payable(msg.sender).call{value: liquidatorReward}("");
        require(success, "Transfer failed");
        
        emit PositionLiquidated(positionId, msg.sender, position.borrower);
    }
    
    function repayPosition(uint256 positionId) external payable nonReentrant {
        Position storage position = positions[positionId];
        require(position.active, "Position not active");
        require(msg.sender == position.borrower, "Not position owner");
        require(msg.value >= position.borrowAmount, "Insufficient repayment");
        
        uint256 collateralToReturn = position.collateralAmount;
        position.active = false;
        
        (bool success, ) = payable(msg.sender).call{value: collateralToReturn}("");
        require(success, "Transfer failed");
        
        if (msg.value > position.borrowAmount) {
            (success, ) = payable(msg.sender).call{value: msg.value - position.borrowAmount}("");
            require(success, "Refund failed");
        }
        
        emit PositionRepaid(positionId, msg.sender);
    }
    
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }
    
    function getPositionDetails(uint256 positionId) external view returns (
        Position memory position,
        uint256 collateralValue,
        uint256 borrowValue,
        uint256 healthRatio
    ) {
        position = positions[positionId];
        require(position.active, "Position not active");
        
        PythStructs.Price memory collateralPrice = pyth.getPriceUnsafe(position.collateralAsset);
        PythStructs.Price memory borrowPrice = pyth.getPriceUnsafe(position.borrowAsset);
        
        collateralValue = position.collateralAmount * uint256(uint64(collateralPrice.price));
        borrowValue = position.borrowAmount * uint256(uint64(borrowPrice.price));
        
        if (borrowValue == 0) {
            healthRatio = type(uint256).max;
        } else {
            healthRatio = (collateralValue * BASIS_POINTS) / borrowValue;
        }
    }
    
    function getAllActivePositions() external view returns (uint256[] memory) {
        uint256 activeCount = 0;
        
        for (uint256 i = 1; i < nextPositionId; i++) {
            if (positions[i].active) {
                activeCount++;
            }
        }
        
        uint256[] memory activePositions = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 1; i < nextPositionId; i++) {
            if (positions[i].active) {
                activePositions[index] = i;
                index++;
            }
        }
        
        return activePositions;
    }
    
    receive() external payable {}
}