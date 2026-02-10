// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title X402EscrowReceiver
 * @notice Extended payment receiver with escrow and refund support.
 *         Funds are held in the contract until explicitly released or refunded
 *         by the owner. This enables dispute resolution and refund workflows
 *         for the x402 protocol.
 *
 *         This contract is an EXTENSION of X402PaymentReceiver.
 *         Use X402PaymentReceiver for instant settlement (default),
 *         or X402EscrowReceiver when refund capability is needed.
 *
 * @dev Payment lifecycle:
 *        Buyer  → holdNative / holdToken  → Held
 *        Owner  → releasePayment          → Released (funds → treasury)
 *        Owner  → refundPayment           → Refunded (funds → payer)
 */

interface IERC20Escrow {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract X402EscrowReceiver {
    address public owner;
    address public treasury;

    enum EscrowStatus { None, Held, Released, Refunded }

    struct EscrowPayment {
        address payer;
        address token;      // address(0) for native CFX
        uint256 amount;
        EscrowStatus status;
    }

    mapping(bytes32 => EscrowPayment) public escrows;

    event PaymentHeld(
        bytes32 indexed invoiceId,
        address indexed payer,
        address token,
        uint256 amount
    );
    event PaymentReleased(
        bytes32 indexed invoiceId,
        address indexed payer,
        uint256 amount
    );
    event PaymentRefunded(
        bytes32 indexed invoiceId,
        address indexed payer,
        uint256 amount
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
    // Hold payments in escrow
    // ────────────────────────────────────────────

    /**
     * @notice Hold native CFX in escrow until released or refunded.
     * @param invoiceId Unique invoice identifier (must not already exist)
     */
    function holdNative(bytes32 invoiceId) external payable {
        require(msg.value > 0, "Zero payment");
        require(escrows[invoiceId].status == EscrowStatus.None, "Invoice exists");

        escrows[invoiceId] = EscrowPayment({
            payer: msg.sender,
            token: address(0),
            amount: msg.value,
            status: EscrowStatus.Held
        });

        emit PaymentHeld(invoiceId, msg.sender, address(0), msg.value);
    }

    /**
     * @notice Hold ERC-20 tokens in escrow. Caller must approve this contract first.
     * @param token     ERC-20 token address
     * @param amount    Payment amount
     * @param invoiceId Unique invoice identifier (must not already exist)
     */
    function holdToken(address token, uint256 amount, bytes32 invoiceId) external {
        require(amount > 0, "Zero amount");
        require(token != address(0), "Use holdNative for CFX");
        require(escrows[invoiceId].status == EscrowStatus.None, "Invoice exists");

        require(
            IERC20Escrow(token).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        escrows[invoiceId] = EscrowPayment({
            payer: msg.sender,
            token: token,
            amount: amount,
            status: EscrowStatus.Held
        });

        emit PaymentHeld(invoiceId, msg.sender, token, amount);
    }

    // ────────────────────────────────────────────
    // Release / Refund (owner only)
    // ────────────────────────────────────────────

    /**
     * @notice Release escrowed payment to treasury.
     * @param invoiceId Invoice to release
     */
    function releasePayment(bytes32 invoiceId) external onlyOwner {
        EscrowPayment storage escrow = escrows[invoiceId];
        require(escrow.status == EscrowStatus.Held, "Not in escrow");

        escrow.status = EscrowStatus.Released;

        if (escrow.token == address(0)) {
            (bool sent, ) = treasury.call{value: escrow.amount}("");
            require(sent, "CFX transfer failed");
        } else {
            require(
                IERC20Escrow(escrow.token).transfer(treasury, escrow.amount),
                "Token transfer failed"
            );
        }

        emit PaymentReleased(invoiceId, escrow.payer, escrow.amount);
    }

    /**
     * @notice Refund escrowed payment back to the original payer.
     * @param invoiceId Invoice to refund
     */
    function refundPayment(bytes32 invoiceId) external onlyOwner {
        EscrowPayment storage escrow = escrows[invoiceId];
        require(escrow.status == EscrowStatus.Held, "Not in escrow");

        escrow.status = EscrowStatus.Refunded;

        if (escrow.token == address(0)) {
            (bool sent, ) = escrow.payer.call{value: escrow.amount}("");
            require(sent, "CFX refund failed");
        } else {
            require(
                IERC20Escrow(escrow.token).transfer(escrow.payer, escrow.amount),
                "Token refund failed"
            );
        }

        emit PaymentRefunded(invoiceId, escrow.payer, escrow.amount);
    }

    // ────────────────────────────────────────────
    // View
    // ────────────────────────────────────────────

    /**
     * @notice Check escrow status for an invoice.
     * @return payer   Original payer address
     * @return token   Token address (address(0) for CFX)
     * @return amount  Escrowed amount
     * @return status  0=None, 1=Held, 2=Released, 3=Refunded
     */
    function getEscrow(bytes32 invoiceId) external view returns (
        address payer,
        address token,
        uint256 amount,
        EscrowStatus status
    ) {
        EscrowPayment storage e = escrows[invoiceId];
        return (e.payer, e.token, e.amount, e.status);
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

    receive() external payable {}
}
