// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract PriceFeedBetting {
    IPyth public immutable pyth;
    
    struct Bet {
        address bettor;
        bytes32 priceId;
        uint256 amount;
        int64 targetPrice;
        uint256 deadline;
        bool predictAbove;
        bool settled;
        bool won;
    }
    
    mapping(uint256 => Bet) public bets;
    mapping(address => uint256[]) public userBets;
    uint256 public nextBetId;
    
    uint256 public constant MIN_BET = 0.01 ether;
    uint256 public constant MAX_BET = 100 ether;
    uint256 public constant MIN_DURATION = 1 hours;
    uint256 public constant MAX_DURATION = 30 days;
    uint256 public constant PLATFORM_FEE = 2;
    
    address public owner;
    uint256 public collectedFees;
    
    event BetPlaced(uint256 indexed betId, address indexed bettor, bytes32 priceId, int64 targetPrice, uint256 amount);
    event BetSettled(uint256 indexed betId, bool won, int64 finalPrice);
    event FeesWithdrawn(uint256 amount);
    
    error InvalidBetAmount();
    error InvalidDuration();
    error InvalidTargetPrice();
    error BetNotExpired();
    error BetAlreadySettled();
    error TransferFailed();
    error Unauthorized();
    
    constructor(address pythContract) {
        require(pythContract != address(0), "Invalid Pyth address");
        pyth = IPyth(pythContract);
        owner = msg.sender;
    }
    
    function placeBet(
        bytes32 priceId,
        int64 targetPrice,
        bool predictAbove,
        uint256 duration
    ) external payable returns (uint256 betId) {
        if (msg.value < MIN_BET || msg.value > MAX_BET) {
            revert InvalidBetAmount();
        }
        
        if (duration < MIN_DURATION || duration > MAX_DURATION) {
            revert InvalidDuration();
        }
        
        if (targetPrice <= 0) {
            revert InvalidTargetPrice();
        }
        
        betId = nextBetId++;
        
        bets[betId] = Bet({
            bettor: msg.sender,
            priceId: priceId,
            amount: msg.value,
            targetPrice: targetPrice,
            deadline: block.timestamp + duration,
            predictAbove: predictAbove,
            settled: false,
            won: false
        });
        
        userBets[msg.sender].push(betId);
        
        emit BetPlaced(betId, msg.sender, priceId, targetPrice, msg.value);
    }
    
    function settleBet(uint256 betId) external {
        Bet storage bet = bets[betId];
        
        if (bet.settled) {
            revert BetAlreadySettled();
        }
        
        if (block.timestamp < bet.deadline) {
            revert BetNotExpired();
        }
        
        PythStructs.Price memory priceData = pyth.getPriceUnsafe(bet.priceId);
        
        bool won = bet.predictAbove 
            ? priceData.price >= bet.targetPrice
            : priceData.price <= bet.targetPrice;
        
        bet.settled = true;
        bet.won = won;
        
        if (won) {
            uint256 fee = (bet.amount * 2 * PLATFORM_FEE) / 100;
            uint256 payout = (bet.amount * 2) - fee;
            collectedFees += fee;
            
            (bool success, ) = bet.bettor.call{value: payout}("");
            if (!success) revert TransferFailed();
        }
        
        emit BetSettled(betId, won, priceData.price);
    }
    
    function getUserBets(address user) external view returns (uint256[] memory) {
        return userBets[user];
    }
    
    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }
    
    function withdrawFees() external {
        if (msg.sender != owner) revert Unauthorized();
        
        uint256 amount = collectedFees;
        collectedFees = 0;
        
        (bool success, ) = owner.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit FeesWithdrawn(amount);
    }
    
    receive() external payable {}
}