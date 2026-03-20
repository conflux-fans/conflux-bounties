// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPyth.sol";

/**
 * @title PricePredictionMarket
 * @notice A simple prediction market that resolves bets using Pyth oracle
 */
contract PricePredictionMarket {
    IPyth public immutable pyth;
    bytes32 public priceId;

    struct Bet {
        address bettor;
        uint256 amount;
        bool directionIsUp; // true = bet price goes up, false = goes down
        uint256 targetPrice; // 18 decimals
        uint256 resolveTime;
        bool resolved;
        bool won;
        uint256 payout;
    }

    uint256 public nextBetId;
    mapping(uint256 => Bet) public bets;

    uint256 public totalPool;
    uint256 public platformFee = 200; // 2% in basis points

    event BetPlaced(uint256 indexed betId, address indexed bettor, uint256 amount, bool directionIsUp, uint256 targetPrice, uint256 resolveTime);
    event BetResolved(uint256 indexed betId, int64 actualPrice, bool won, uint256 payout);

    error BetAlreadyResolved(uint256 betId);
    error InvalidBetAmount(uint256 amount);
    error ResolveTimeNotReached(uint256 betId, uint256 resolveTime);

    constructor(address pythContract, bytes32 _priceId) {
        pyth = IPyth(pythContract);
        priceId = _priceId;
    }

    /**
     * @notice Place a bet on price direction
     * @param directionIsUp true if betting price goes up
     * @param targetPrice The target price threshold (18 decimals)
     * @param durationSeconds How long until resolution
     */
    function placeBet(bool directionIsUp, uint256 targetPrice, uint256 durationSeconds) external payable returns (uint256) {
        if (msg.value < 0.001 ether) revert InvalidBetAmount(msg.value);

        uint256 betId = nextBetId++;
        bets[betId] = Bet({
            bettor: msg.sender,
            amount: msg.value,
            directionIsUp: directionIsUp,
            targetPrice: targetPrice,
            resolveTime: block.timestamp + durationSeconds,
            resolved: false,
            won: false,
            payout: 0
        });

        totalPool += msg.value;

        emit BetPlaced(betId, msg.sender, msg.value, directionIsUp, targetPrice, block.timestamp + durationSeconds);
        return betId;
    }

    /**
     * @notice Resolve a bet using Pyth oracle price
     * @param betId The bet to resolve
     * @param priceUpdateData Pyth price update data
     */
    function resolveBet(uint256 betId, bytes[] calldata priceUpdateData) external payable {
        Bet storage bet = bets[betId];
        if (bet.resolved) revert BetAlreadyResolved(betId);
        if (block.timestamp < bet.resolveTime) revert ResolveTimeNotReached(betId, bet.resolveTime);

        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        (int64 rawPrice,,int32 expo,,,) = pyth.getPrice(priceId);
        uint256 currentPrice = _normalizePrice(rawPrice, expo);

        bet.resolved = true;

        bool priceUp = currentPrice >= bet.targetPrice;
        bet.won = (bet.directionIsUp == priceUp);

        if (bet.won) {
            uint256 feeAmount = (bet.amount * platformFee) / 10000;
            bet.payout = bet.amount * 2 - feeAmount;
            totalPool -= bet.payout;
            (bool success,) = payable(bet.bettor).call{value: bet.payout}("");
            require(success, "Transfer failed");
        } else {
            totalPool -= bet.amount;
        }

        emit BetResolved(betId, rawPrice, bet.won, bet.payout);
    }

    function _normalizePrice(int64 rawPrice, int32 expo) internal pure returns (uint256) {
        int256 normalized = int256(rawPrice);
        if (expo < 0) {
            uint256 absExpo = uint256(int256(-expo));
            for (uint256 i = 0; i < absExpo; i++) {
                normalized /= 10;
            }
        }
        return uint256(normalized);
    }
}
