// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IERC3009
 * @notice Minimal interface for ERC-3009 tokens (USDT0, USDC, AxCNH).
 * @dev Only non-fee-on-transfer, non-rebasing, standard ERC-20 tokens with
 *      ERC-3009 support should be registered. ERC-777 tokens are unsupported.
 */
interface IERC3009 {
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);
}

/**
 * @title X402PaymentVerifier
 * @notice Multi-tenant x402 facilitator for Conflux eSpace. Any seller can register
 *         their wallet and API, then settle ERC-3009 payments through this shared contract.
 *
 *         The buyer signs an off-chain EIP-712 ReceiveWithAuthorization where `to` is
 *         this contract. The seller calls settle() to execute the authorization, receive
 *         funds into this contract, and forward them to the seller. This prevents
 *         front-running and ensures all payments are recorded.
 *
 *         Only the recipient (seller) can call settle(), binding the invoiceId to the
 *         payment. This prevents third parties from misbinding payments.
 */
contract X402PaymentVerifier is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Maximum time an authorization can be valid into the future (7 days)
    uint256 public constant MAX_AUTH_DURATION = 7 days;

    struct Payment {
        address payer;
        address recipient;
        uint256 amount;
        address token;
        string endpoint;
        bytes32 nonce;
        uint256 expiry;
        uint256 paidAt;
    }

    struct Seller {
        address wallet;
        string apiBaseUrl;
        string description;
        bool active;
        uint256 registeredAt;
    }

    /// @notice Supported ERC-3009 tokens (managed by contract owner)
    /// @dev Only add non-fee-on-transfer, non-rebasing tokens with ERC-3009 support
    mapping(address => bool) public supportedTokens;

    /// @notice invoiceId => Payment record
    mapping(bytes32 => Payment) public payments;

    /// @notice Track used authorization nonces
    mapping(bytes32 => bool) public usedNonces;

    /// @notice Seller registry: wallet address => Seller
    mapping(address => Seller) public sellers;

    /// @notice List of active seller addresses (maintained via swap-and-pop)
    address[] public sellerList;

    /// @dev Index tracking for O(1) swap-and-pop removal
    mapping(address => uint256) private _sellerIndex;

    event PaymentReceived(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed recipient,
        address token,
        uint256 amount,
        string endpoint,
        bytes32 nonce
    );

    event Refunded(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed token,
        uint256 amount
    );

    event SellerRegistered(address indexed wallet, string apiBaseUrl);
    event SellerUpdated(address indexed wallet, string apiBaseUrl);
    event SellerDeactivated(address indexed wallet);
    event TokenSupported(address indexed token, bool supported);

    /// @param _tokens Initial supported ERC-3009 token addresses
    constructor(address[] memory _tokens) Ownable(msg.sender) {
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(_tokens[i] != address(0), "X402: zero token address");
            require(_tokens[i].code.length > 0, "X402: token has no code");
            supportedTokens[_tokens[i]] = true;
            emit TokenSupported(_tokens[i], true);
        }
    }

    /// @dev Disable renounceOwnership to prevent bricking admin functions
    function renounceOwnership() public pure override {
        revert("X402: renounce disabled");
    }

    // ─── Seller Registration ───

    /**
     * @notice Register as a seller. Each address can only register once.
     *         Use reactivateSeller() after deactivation.
     */
    function registerSeller(string calldata apiBaseUrl, string calldata description) external {
        require(bytes(apiBaseUrl).length > 0, "X402: empty API URL");
        require(sellers[msg.sender].registeredAt == 0, "X402: already registered");

        sellers[msg.sender] = Seller({
            wallet: msg.sender,
            apiBaseUrl: apiBaseUrl,
            description: description,
            active: true,
            registeredAt: block.timestamp
        });
        _sellerIndex[msg.sender] = sellerList.length;
        sellerList.push(msg.sender);

        emit SellerRegistered(msg.sender, apiBaseUrl);
    }

    /**
     * @notice Reactivate a previously deactivated seller registration.
     */
    function reactivateSeller(string calldata apiBaseUrl, string calldata description) external {
        require(sellers[msg.sender].registeredAt > 0, "X402: not registered");
        require(!sellers[msg.sender].active, "X402: already active");

        sellers[msg.sender].apiBaseUrl = apiBaseUrl;
        sellers[msg.sender].description = description;
        sellers[msg.sender].active = true;

        _sellerIndex[msg.sender] = sellerList.length;
        sellerList.push(msg.sender);

        emit SellerRegistered(msg.sender, apiBaseUrl);
    }

    /**
     * @notice Update seller profile. Only the seller themselves.
     */
    function updateSeller(string calldata apiBaseUrl, string calldata description) external {
        require(sellers[msg.sender].active, "X402: not registered");
        require(bytes(apiBaseUrl).length > 0, "X402: empty API URL");

        sellers[msg.sender].apiBaseUrl = apiBaseUrl;
        sellers[msg.sender].description = description;

        emit SellerUpdated(msg.sender, apiBaseUrl);
    }

    /**
     * @notice Deactivate seller registration. Removes from active list via swap-and-pop.
     */
    function deactivateSeller(address wallet) external {
        require(
            msg.sender == wallet || msg.sender == owner(),
            "X402: not authorized"
        );
        require(sellers[wallet].active, "X402: not active");

        sellers[wallet].active = false;

        // Swap-and-pop from sellerList for O(1) removal
        uint256 idx = _sellerIndex[wallet];
        uint256 lastIdx = sellerList.length - 1;
        if (idx != lastIdx) {
            address lastSeller = sellerList[lastIdx];
            sellerList[idx] = lastSeller;
            _sellerIndex[lastSeller] = idx;
        }
        sellerList.pop();
        delete _sellerIndex[wallet];

        emit SellerDeactivated(wallet);
    }

    // ─── Settlement ───

    /**
     * @notice Settle an x402 payment by executing an ERC-3009 receiveWithAuthorization.
     *         Only the recipient (seller) can call this, preventing front-running and
     *         ensuring the invoiceId binding is controlled by the intended payee.
     *
     *         The buyer signs a ReceiveWithAuthorization where `to` = address(this).
     *         This contract receives the funds, then forwards them to the recipient.
     *
     * @param invoiceId   Unique invoice identifier (bound by the recipient/seller)
     * @param token       ERC-3009 token address
     * @param from        The payer (signer of the authorization)
     * @param recipient   The payment recipient — must equal msg.sender
     * @param value       Nominal amount in token units
     * @param validAfter  ERC-3009 validity start timestamp
     * @param validBefore ERC-3009 validity end timestamp (must be within MAX_AUTH_DURATION)
     * @param nonce       ERC-3009 authorization nonce (bytes32)
     * @param endpoint    API endpoint this payment covers
     * @param v           Signature v
     * @param r           Signature r
     * @param s           Signature s
     */
    function settle(
        bytes32 invoiceId,
        address token,
        address from,
        address recipient,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        string calldata endpoint,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        require(supportedTokens[token], "X402: unsupported token");
        require(value > 0, "X402: zero payment");
        require(recipient != address(0), "X402: zero recipient");
        require(from != recipient, "X402: self-payment");
        require(payments[invoiceId].paidAt == 0, "X402: already paid");
        require(!usedNonces[nonce], "X402: nonce already used");
        require(msg.sender == recipient, "X402: only recipient can settle");
        require(validBefore > validAfter, "X402: invalid time window");
        require(
            validBefore <= block.timestamp + MAX_AUTH_DURATION,
            "X402: auth expires too far in future"
        );
        require(block.timestamp < validBefore, "X402: authorization expired");

        // Effects before interactions (CEI)
        usedNonces[nonce] = true;

        // Receive into this contract first (prevents front-running via receiveWithAuthorization)
        uint256 balBefore = IERC20(token).balanceOf(address(this));
        IERC3009(token).receiveWithAuthorization(
            from,
            address(this),
            value,
            validAfter,
            validBefore,
            nonce,
            v, r, s
        );
        uint256 received = IERC20(token).balanceOf(address(this)) - balBefore;
        require(received > 0, "X402: no tokens received");

        // Store actual received amount (handles fee-on-transfer edge case)
        payments[invoiceId] = Payment({
            payer: from,
            recipient: recipient,
            amount: received,
            token: token,
            endpoint: endpoint,
            nonce: nonce,
            expiry: validBefore,
            paidAt: block.timestamp
        });

        // Forward funds to the recipient
        IERC20(token).safeTransfer(recipient, received);

        emit PaymentReceived(invoiceId, from, recipient, token, received, endpoint, nonce);
    }

    // ─── Verification ───

    /**
     * @notice Verify that an invoice has been paid with correct parameters.
     * @dev expectedAmount must use the token's native decimal scaling.
     */
    function verifyPayment(
        bytes32 invoiceId,
        uint256 expectedAmount,
        string calldata expectedEndpoint
    ) external view returns (bool valid, address payer) {
        Payment storage p = payments[invoiceId];
        if (p.paidAt == 0) return (false, address(0));
        if (p.amount < expectedAmount) return (false, address(0));
        if (keccak256(bytes(p.endpoint)) != keccak256(bytes(expectedEndpoint))) {
            return (false, address(0));
        }
        return (true, p.payer);
    }

    // ─── Refunds ───

    /**
     * @notice Refund a paid invoice back to the original payer.
     *         Only the payment recipient (seller) can initiate.
     *         Requires the recipient to have approved this contract via ERC-20 approve().
     */
    function refund(bytes32 invoiceId) external nonReentrant {
        _refundTo(invoiceId, payments[invoiceId].payer);
    }

    /**
     * @notice Refund a paid invoice to an alternative address (e.g., if the original
     *         payer is blocklisted). Only the payment recipient (seller) can initiate.
     */
    function refundTo(bytes32 invoiceId, address refundRecipient) external nonReentrant {
        require(refundRecipient != address(0), "X402: zero refund recipient");
        _refundTo(invoiceId, refundRecipient);
    }

    function _refundTo(bytes32 invoiceId, address refundRecipient) internal {
        Payment storage p = payments[invoiceId];
        require(p.paidAt > 0, "X402: invoice not paid");
        require(p.amount > 0, "X402: already refunded");
        require(msg.sender == p.recipient, "X402: only recipient can refund");

        uint256 amount = p.amount;
        address token = p.token;
        address recipient = p.recipient;

        // Zero out amount to prevent double-refund (effect before interaction)
        p.amount = 0;

        IERC20(token).safeTransferFrom(recipient, refundRecipient, amount);
        emit Refunded(invoiceId, refundRecipient, token, amount);
    }

    // ─── Admin (Contract Owner) ───

    /**
     * @notice Add or remove a supported token. Only add ERC-3009 compliant tokens.
     * @dev Only non-fee-on-transfer, non-rebasing tokens should be added.
     *      Use a multisig as owner for production deployments.
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        require(token != address(0), "X402: zero token address");
        if (supported) {
            require(token.code.length > 0, "X402: token has no code");
        }
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    // ─── View Functions ───

    function getPayment(bytes32 invoiceId) external view returns (Payment memory) {
        return payments[invoiceId];
    }

    function getSellerCount() external view returns (uint256) {
        return sellerList.length;
    }

    function getSeller(address wallet) external view returns (Seller memory) {
        return sellers[wallet];
    }

    /**
     * @notice Get active sellers with pagination.
     *         sellerList only contains active sellers (deactivated sellers are removed).
     * @param offset Starting index in sellerList
     * @param limit  Maximum number of sellers to return
     */
    function getActiveSellers(uint256 offset, uint256 limit) external view returns (Seller[] memory) {
        uint256 len = sellerList.length;
        if (offset >= len) return new Seller[](0);

        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 count = end - offset;

        Seller[] memory result = new Seller[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = sellers[sellerList[offset + i]];
        }
        return result;
    }
}
