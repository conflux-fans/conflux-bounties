// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "./interfaces/IPriceAdapter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ISwappiRouter {
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

interface ISwappiFactory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/**
 * @title SwappiPriceAdapter
 * @notice Reads spot prices from the Swappi DEX (Uniswap V2 fork) on Conflux eSpace.
 *         Uses the getAmountsOut() call from the Swappi Router as a price oracle.
 *
 * @dev NOT suitable as a sole oracle in production — use with TWAP or multi-source
 *      aggregation. This implementation is acceptable for testnet and Phase-1 scope.
 */
contract SwappiPriceAdapter is IPriceAdapter, Ownable {

    // ─── State ───────────────────────────────────────────────────────────────

    ISwappiRouter public router;
    ISwappiFactory public factory;

    /// @notice Amount of tokenIn used as the reference quote (1e18 for 18-decimal tokens).
    uint256 public quoteAmount = 1e18;

    // ─── Events ──────────────────────────────────────────────────────────────

    event RouterUpdated(address indexed newRouter);
    event FactoryUpdated(address indexed newFactory);
    event QuoteAmountUpdated(uint256 newAmount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _router, address _factory, address initialOwner) Ownable(initialOwner) {
        require(_router != address(0) && _factory != address(0), "ZeroAddress");
        router = ISwappiRouter(_router);
        factory = ISwappiFactory(_factory);
    }

    // ─── IPriceAdapter ───────────────────────────────────────────────────────

    /**
     * @inheritdoc IPriceAdapter
     * @dev Returns 0 if the pair doesn't exist or the call reverts. The
     *      AutomationManager treats 0 as an invalid price and will not execute.
     */
    function getPrice(address tokenIn, address tokenOut) external view override returns (uint256 price) {
        // Check pair existence first to avoid revert-masking issues.
        address pair = factory.getPair(tokenIn, tokenOut);
        if (pair == address(0)) return 0;

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        try router.getAmountsOut(quoteAmount, path) returns (uint256[] memory amounts) {
            price = amounts[1];
        } catch {
            price = 0;
        }
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "ZeroAddress");
        router = ISwappiRouter(_router);
        emit RouterUpdated(_router);
    }

    function setFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "ZeroAddress");
        factory = ISwappiFactory(_factory);
        emit FactoryUpdated(_factory);
    }

    function setQuoteAmount(uint256 _quoteAmount) external onlyOwner {
        require(_quoteAmount > 0, "QuoteAmount must be > 0");
        quoteAmount = _quoteAmount;
        emit QuoteAmountUpdated(_quoteAmount);
    }
}
