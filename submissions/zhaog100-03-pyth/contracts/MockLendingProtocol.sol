// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IPyth.sol";

/**
 * @title MockLendingProtocol
 * @notice A mock lending protocol demonstrating oracle-based liquidations
 */
contract MockLendingProtocol {
    IPyth public immutable pyth;
    bytes32 public collateralPriceId;

    struct Position {
        uint256 collateralAmount;   // Amount of collateral token (in token units)
        uint256 borrowAmount;       // Amount borrowed (in USD, 18 decimals)
        uint256 collateralPrice;    // Last known collateral price (18 decimals)
        bool liquidated;
    }

    mapping(address => Position) public positions;
    address[] public users;

    // 150% collateralization ratio required
    uint256 public constant LIQUIDATION_RATIO = 150;
    // 1% liquidation bonus
    uint256 public constant LIQUIDATION_BONUS = 10100; // basis points
    // 8-hour max price age
    uint256 public constant MAX_PRICE_AGE = 8 hours;

    uint256 public totalCollateral;
    uint256 public totalBorrowed;

    event Deposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event Liquidated(address indexed user, address indexed liquidator, uint256 collateralSeized);
    event Repaid(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    error InsufficientCollateral(uint256 collateralValue, uint256 borrowAmount);
    error PositionHealthy(address user);
    error AlreadyLiquidated(address user);
    error NothingToWithdraw(address user);
    error NothingToRepay(address user);

    constructor(address pythContract, bytes32 _collateralPriceId) {
        pyth = IPyth(pythContract);
        collateralPriceId = _collateralPriceId;
    }

    /**
     * @notice Deposit collateral and open a position
     * @param amount Amount of collateral to deposit
     */
    function deposit(uint256 amount) external {
        if (amount == 0) revert("Zero deposit");

        Position storage pos = positions[msg.sender];
        if (pos.collateralAmount == 0) {
            users.push(msg.sender);
        }

        pos.collateralAmount += amount;
        totalCollateral += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Borrow against deposited collateral (requires price update)
     * @param borrowAmount Amount to borrow in USD (18 decimals)
     * @param priceUpdateData Pyth price update data
     */
    function borrow(uint256 borrowAmount, bytes[] calldata priceUpdateData) external payable {
        if (borrowAmount == 0) revert("Zero borrow");

        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: msg.value}(priceUpdateData);

        Position storage pos = positions[msg.sender];
        (int64 rawPrice,,int32 expo,,,) = pyth.getPrice(collateralPriceId);

        // Convert to 18 decimals
        uint256 price = _normalizePrice(rawPrice, expo);
        pos.collateralPrice = price;

        uint256 collateralValue = (pos.collateralAmount * price) / 1e18;
        uint256 maxBorrow = (collateralValue * 100) / LIQUIDATION_RATIO;

        if (maxBorrow < borrowAmount + pos.borrowAmount) {
            revert InsufficientCollateral(collateralValue, borrowAmount + pos.borrowAmount);
        }

        pos.borrowAmount += borrowAmount;
        totalBorrowed += borrowAmount;

        emit Borrowed(msg.sender, borrowAmount);
    }

    /**
     * @notice Liquidate an underwater position
     * @param user Address of the borrower to liquidate
     * @param priceUpdateData Pyth price update data
     */
    function liquidate(address user, bytes[] calldata priceUpdateData) external payable {
        Position storage pos = positions[user];
        if (pos.liquidated) revert AlreadyLiquidated(user);
        if (pos.borrowAmount == 0) revert("No borrow");

        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: msg.value}(priceUpdateData);

        (int64 rawPrice,,int32 expo, uint256 publishTime,,) = pyth.getPrice(collateralPriceId);
        require(block.timestamp - publishTime <= MAX_PRICE_AGE, "Price too stale");

        uint256 price = _normalizePrice(rawPrice, expo);
        pos.collateralPrice = price;

        uint256 collateralValue = (pos.collateralAmount * price) / 1e18;

        // Check if underwater: collateral < borrow * ratio
        if (collateralValue * 100 >= pos.borrowAmount * LIQUIDATION_RATIO) {
            revert PositionHealthy(user);
        }

        pos.liquidated = true;

        // Calculate seizure amount with bonus
        uint256 seizeAmount = (pos.collateralAmount * LIQUIDATION_BONUS) / 10000;
        seizeAmount = seizeAmount > pos.collateralAmount ? pos.collateralAmount : seizeAmount;

        pos.collateralAmount = 0;
        pos.borrowAmount = 0;
        totalCollateral -= seizeAmount;
        totalBorrowed -= pos.borrowAmount;

        emit Liquidated(user, msg.sender, seizeAmount);
    }

    /**
     * @notice Repay borrowed amount
     */
    function repay(uint256 amount) external {
        Position storage pos = positions[msg.sender];
        if (pos.borrowAmount == 0) revert NothingToRepay(msg.sender);
        if (amount > pos.borrowAmount) amount = pos.borrowAmount;

        pos.borrowAmount -= amount;
        totalBorrowed -= amount;

        emit Repaid(msg.sender, amount);
    }

    /**
     * @notice Withdraw excess collateral
     * @param amount Amount to withdraw
     * @param priceUpdateData Pyth price update data
     */
    function withdraw(uint256 amount, bytes[] calldata priceUpdateData) external payable {
        Position storage pos = positions[msg.sender];
        if (amount == 0 || pos.collateralAmount == 0) revert NothingToWithdraw(msg.sender);

        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        (int64 rawPrice,,int32 expo,,,) = pyth.getPrice(collateralPriceId);
        uint256 price = _normalizePrice(rawPrice, expo);

        uint256 remainingCollateral = pos.collateralAmount - amount;
        uint256 remainingValue = (remainingCollateral * price) / 1e18;

        if (remainingValue * 100 < pos.borrowAmount * LIQUIDATION_RATIO) {
            revert InsufficientCollateral(remainingValue, pos.borrowAmount);
        }

        pos.collateralAmount = remainingCollateral;
        totalCollateral -= amount;

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Get position health info
     */
    function getPositionInfo(address user) external view returns (
        uint256 collateral, uint256 borrow, uint256 collateralValue, bool isHealthy
    ) {
        Position memory pos = positions[user];
        collateral = pos.collateralAmount;
        borrow = pos.borrowAmount;

        if (pos.collateralPrice > 0) {
            collateralValue = (pos.collateralAmount * pos.collateralPrice) / 1e18;
        }

        if (borrow == 0) {
            isHealthy = true;
        } else {
            isHealthy = collateralValue * 100 >= borrow * LIQUIDATION_RATIO;
        }
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
