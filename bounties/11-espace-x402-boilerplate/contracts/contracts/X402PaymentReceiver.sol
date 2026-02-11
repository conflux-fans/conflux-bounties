// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title X402PaymentReceiver
 * @notice Universal payment receiver for x402 protocol on Conflux eSpace.
 *         Supports three payment methods:
 *           1. Native CFX — payNative(invoiceId){value}
 *           2. ERC-20 — buyer approves contract, relayer calls payWithTokenFrom
 *           3. EIP-3009 — gasless transferWithAuthorization (USDT0)
 *
 * @dev Emits PaymentReceived for every successful payment.
 *      Server monitors events to verify invoices.
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IEIP3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
}

contract X402PaymentReceiver {
    address public owner;
    address public treasury;

    event PaymentReceived(
        bytes32 indexed invoiceId,
        address indexed payer,
        address token,         // address(0) for native CFX
        uint256 amount,
        string paymentMethod   // "native", "erc20", "eip3009"
    );

    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event OwnershipTransferred(address oldOwner, address newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), "Invalid treasury");
        owner = msg.sender;
        treasury = _treasury;
    }

    // ────────────────────────────────────────────
    // 1. Native CFX payment
    // ────────────────────────────────────────────

    /**
     * @notice Pay with native CFX. InvoiceId passed as calldata.
     * @dev Call: contract.payNative{value: amount}(invoiceId)
     */
    function payNative(bytes32 invoiceId) external payable {
        require(msg.value > 0, "Zero payment");

        // Forward CFX to treasury
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "CFX transfer failed");

        emit PaymentReceived(invoiceId, msg.sender, address(0), msg.value, "native");
    }

    // ────────────────────────────────────────────
    // 2a. ERC-20 payment — buyer calls directly
    // ────────────────────────────────────────────

    /**
     * @notice Pay with ERC-20 token. Caller must approve this contract first.
     * @param token   ERC-20 token address
     * @param amount  Payment amount (in token's smallest unit)
     * @param invoiceId  Unique invoice identifier
     */
    function payWithToken(
        address token,
        uint256 amount,
        bytes32 invoiceId
    ) external {
        require(amount > 0, "Zero amount");
        require(token != address(0), "Use payNative for CFX");

        IERC20 erc20 = IERC20(token);
        require(
            erc20.allowance(msg.sender, address(this)) >= amount,
            "Insufficient allowance"
        );

        bool success = erc20.transferFrom(msg.sender, treasury, amount);
        require(success, "Token transfer failed");

        emit PaymentReceived(invoiceId, msg.sender, token, amount, "erc20");
    }

    // ────────────────────────────────────────────
    // 2b. ERC-20 payment — relayer calls on behalf of buyer
    // ────────────────────────────────────────────

    /**
     * @notice Settle ERC-20 payment on behalf of buyer.
     *         Buyer must have approved this contract (not the relayer).
     *         Only relayer (owner) can call this function.
     * @param token     ERC-20 token address
     * @param from      Buyer address who approved the spend
     * @param amount    Payment amount
     * @param invoiceId Unique invoice identifier
     */
    function payWithTokenFrom(
        address token,
        address from,
        uint256 amount,
        bytes32 invoiceId
    ) external onlyOwner {
        require(amount > 0, "Zero amount");
        require(token != address(0), "Use payNative for CFX");
        require(from != address(0), "Invalid payer");

        IERC20 erc20 = IERC20(token);
        require(
            erc20.allowance(from, address(this)) >= amount,
            "Insufficient allowance"
        );

        bool success = erc20.transferFrom(from, treasury, amount);
        require(success, "Token transfer failed");

        emit PaymentReceived(invoiceId, from, token, amount, "erc20");
    }

    // ────────────────────────────────────────────
    // 3. EIP-3009 payment (gasless for buyer)
    // ────────────────────────────────────────────

    /**
     * @notice Settle payment using EIP-3009 transferWithAuthorization.
     *         Only the relayer (owner) calls this — buyer signs off-chain.
     * @param token       EIP-3009 compatible token address
     * @param from        Buyer address
     * @param amount      Payment amount
     * @param validAfter  EIP-3009 validAfter timestamp
     * @param validBefore EIP-3009 validBefore timestamp
     * @param nonce       EIP-3009 nonce (bytes32)
     * @param signature   EIP-712 signature from buyer
     * @param invoiceId   Unique invoice identifier
     */
    function payWithAuthorization(
        address token,
        address from,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature,
        bytes32 invoiceId
    ) external onlyOwner {
        require(amount > 0, "Zero amount");

        IEIP3009(token).transferWithAuthorization(
            from,
            treasury,
            amount,
            validAfter,
            validBefore,
            nonce,
            signature
        );

        emit PaymentReceived(invoiceId, from, token, amount, "eip3009");
    }

    // ────────────────────────────────────────────
    // Admin
    // ────────────────────────────────────────────

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Rescue stuck tokens or CFX (safety net)
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool sent, ) = owner.call{value: amount}("");
            require(sent, "CFX rescue failed");
        } else {
            bool sent = IERC20(token).transfer(owner, amount);
            require(sent, "Token rescue failed");
        }
    }

    receive() external payable {
        // Accept plain CFX transfers (without invoiceId)
        (bool sent, ) = treasury.call{value: msg.value}("");
        require(sent, "CFX forward failed");
    }
}
