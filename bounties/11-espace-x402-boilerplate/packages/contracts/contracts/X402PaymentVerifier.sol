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
 * @notice Multi-tenant x402 facilitator for Conflux eSpace with escrow-based refunds.
 *
 *         The buyer signs an off-chain EIP-712 ReceiveWithAuthorization where `to` is
 *         this contract. The seller calls settle() to execute the authorization. Funds
 *         are held in escrow for a grace period during which the seller can issue refunds.
 *         After the grace period, the seller (or anyone) can call release() to transfer
 *         funds to the seller.
 *
 *         Escrow eliminates the need for ERC-20 approval for refunds: since the contract
 *         holds the tokens, refunds use safeTransfer (not safeTransferFrom).
 */
contract X402PaymentVerifier is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Chain ID recorded at deployment; validated in settle() to prevent cross-chain replay
    uint256 public immutable DEPLOYMENT_CHAIN_ID;

    /// @notice Maximum time an authorization can be valid into the future (7 days)
    uint256 public constant MAX_AUTH_DURATION = 7 days;

    /// @notice Default escrow duration when seller doesn't specify one
    uint256 public constant DEFAULT_ESCROW_DURATION = 24 hours;

    /// @notice Minimum escrow duration (0 = immediate release, no escrow)
    uint256 public constant MIN_ESCROW_DURATION = 0;

    /// @notice Maximum escrow duration (30 days)
    uint256 public constant MAX_ESCROW_DURATION = 30 days;

    struct Payment {
        address payer;
        address recipient;
        uint256 amount;
        address token;
        string endpoint;
        bytes32 nonce;
        uint256 expiry;
        uint256 paidAt;
        uint256 releaseAt;  // Timestamp when funds can be released to seller
        bool released;      // True after funds have been sent to seller
        bool refunded;      // True after funds have been refunded to payer
    }

    struct Seller {
        address wallet;
        string apiBaseUrl;
        string description;
        bool active;
        uint256 registeredAt;
        uint256 escrowDuration; // Per-seller escrow period in seconds
    }

    /// @notice Supported ERC-3009 tokens (managed by contract owner)
    /// @dev Only add non-fee-on-transfer, non-rebasing tokens with ERC-3009 support
    mapping(address => bool) public supportedTokens;

    /// @notice invoiceId => Payment record
    mapping(bytes32 => Payment) public payments;

    /// @notice Track used authorization nonces, scoped by (authorizer, nonce)
    mapping(bytes32 => bool) public usedNonces;

    /// @notice Seller registry: wallet address => Seller
    mapping(address => Seller) public sellers;

    /// @notice List of active seller addresses (maintained via swap-and-pop)
    address[] public sellerList;

    /// @dev Index tracking for O(1) swap-and-pop removal
    mapping(address => uint256) private _sellerIndex;

    /// @notice Registration fee to prevent seller spam (payable in native CFX)
    uint256 public registrationFee;

    /// @notice Pending token activations (timelock for adding new tokens)
    mapping(address => uint256) public pendingTokenActivation;

    /// @notice Timelock delay for adding new supported tokens
    uint256 public constant TOKEN_ACTIVATION_DELAY = 48 hours;

    event PaymentReceived(
        bytes32 indexed invoiceId,
        address indexed payer,
        address indexed recipient,
        address token,
        uint256 amount,
        string endpoint,
        bytes32 nonce,
        uint256 chainId
    );

    event PaymentReleased(
        bytes32 indexed invoiceId,
        address indexed recipient,
        address token,
        uint256 amount
    );

    event Refunded(
        bytes32 indexed invoiceId,
        address indexed originalPayer,
        address indexed token,
        uint256 amount,
        address refundRecipient
    );

    event SellerRegistered(address indexed wallet, string apiBaseUrl, uint256 escrowDuration);
    event SellerUpdated(address indexed wallet, string apiBaseUrl, uint256 escrowDuration);
    event SellerDeactivated(address indexed wallet);
    event TokenSupported(address indexed token, bool supported);
    event TokenProposed(address indexed token, uint256 activationTime);
    event RegistrationFeeUpdated(uint256 newFee);

    /// @param _tokens Initial supported ERC-3009 token addresses
    constructor(address[] memory _tokens) Ownable(msg.sender) {
        DEPLOYMENT_CHAIN_ID = block.chainid;
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
     * @param escrowDuration Escrow hold period in seconds (0 = immediate release, no escrow).
     *        Must be between MIN_ESCROW_DURATION and MAX_ESCROW_DURATION.
     */
    function registerSeller(string calldata apiBaseUrl, string calldata description, uint256 escrowDuration) external payable {
        require(bytes(apiBaseUrl).length > 0, "X402: empty API URL");
        require(sellers[msg.sender].registeredAt == 0, "X402: already registered");
        require(msg.value >= registrationFee, "X402: insufficient registration fee");

        uint256 escrow = _validateEscrowDuration(escrowDuration);

        sellers[msg.sender] = Seller({
            wallet: msg.sender,
            apiBaseUrl: apiBaseUrl,
            description: description,
            active: true,
            registeredAt: block.timestamp,
            escrowDuration: escrow
        });
        _sellerIndex[msg.sender] = sellerList.length;
        sellerList.push(msg.sender);

        emit SellerRegistered(msg.sender, apiBaseUrl, escrow);
    }

    /**
     * @notice Reactivate a previously deactivated seller registration.
     * @param escrowDuration Escrow hold period in seconds. Pass type(uint256).max to keep previous value.
     *        0 = immediate release (no escrow).
     */
    function reactivateSeller(string calldata apiBaseUrl, string calldata description, uint256 escrowDuration) external payable {
        require(bytes(apiBaseUrl).length > 0, "X402: empty API URL");
        require(sellers[msg.sender].registeredAt > 0, "X402: not registered");
        require(!sellers[msg.sender].active, "X402: already active");
        require(msg.value >= registrationFee, "X402: insufficient registration fee");

        sellers[msg.sender].apiBaseUrl = apiBaseUrl;
        sellers[msg.sender].description = description;
        sellers[msg.sender].active = true;
        if (escrowDuration != type(uint256).max) {
            sellers[msg.sender].escrowDuration = _validateEscrowDuration(escrowDuration);
        }

        _sellerIndex[msg.sender] = sellerList.length;
        sellerList.push(msg.sender);

        emit SellerRegistered(msg.sender, apiBaseUrl, sellers[msg.sender].escrowDuration);
    }

    /**
     * @notice Update seller profile. Only the seller themselves.
     * @param escrowDuration Escrow hold period in seconds. Pass type(uint256).max to keep current value.
     *        0 = immediate release (no escrow).
     */
    function updateSeller(string calldata apiBaseUrl, string calldata description, uint256 escrowDuration) external {
        require(sellers[msg.sender].active, "X402: not registered");
        require(bytes(apiBaseUrl).length > 0, "X402: empty API URL");

        sellers[msg.sender].apiBaseUrl = apiBaseUrl;
        sellers[msg.sender].description = description;
        if (escrowDuration != type(uint256).max) {
            sellers[msg.sender].escrowDuration = _validateEscrowDuration(escrowDuration);
        }

        emit SellerUpdated(msg.sender, apiBaseUrl, sellers[msg.sender].escrowDuration);
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
     *         The invoiceId is derived deterministically as
     *         keccak256(abi.encode(from, recipient, token, nonce)), binding each
     *         payment to the authorization's unique parameters and preventing
     *         misattribution or front-running by other sellers.
     *
     *         Funds are held in escrow for the specified duration. During this period,
     *         the seller can issue a refund. After the period, anyone can call release()
     *         to transfer funds to the seller.
     *
     * @param token           ERC-3009 token address
     * @param from            The payer (signer of the authorization)
     * @param recipient       The payment recipient, must equal msg.sender
     * @param value           Nominal amount in token units
     * @param validAfter      ERC-3009 validity start timestamp
     * @param validBefore     ERC-3009 validity end timestamp (must be within MAX_AUTH_DURATION)
     * @param nonce           ERC-3009 authorization nonce (bytes32)
     * @param endpoint        API endpoint this payment covers
     * @param escrowDuration  Per-settlement escrow override in seconds.
     *                        Pass 0 to use the seller's registered default.
     * @param v               Signature v
     * @param r               Signature r
     * @param s               Signature s
     */
    function settle(
        address token,
        address from,
        address recipient,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        string calldata endpoint,
        uint256 escrowDuration,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        require(block.chainid == DEPLOYMENT_CHAIN_ID, "X402: wrong chain");
        require(supportedTokens[token], "X402: unsupported token");
        require(value > 0, "X402: zero payment");
        require(recipient != address(0), "X402: zero recipient");
        require(from != recipient, "X402: self-payment");

        // Derive invoiceId deterministically from authorization parameters
        bytes32 invoiceId = keccak256(abi.encode(from, recipient, token, nonce));

        require(payments[invoiceId].paidAt == 0, "X402: already paid");
        require(!usedNonces[keccak256(abi.encode(from, nonce))], "X402: nonce already used");
        require(msg.sender == recipient, "X402: only recipient can settle");
        require(sellers[recipient].active, "X402: seller not active");
        require(validBefore > validAfter, "X402: invalid time window");
        require(
            validBefore <= block.timestamp + MAX_AUTH_DURATION,
            "X402: auth expires too far in future"
        );
        require(block.timestamp < validBefore, "X402: authorization expired");

        // Effects before interactions (CEI)
        bytes32 nonceKey = keccak256(abi.encode(from, nonce));
        usedNonces[nonceKey] = true;

        // Receive into this contract (prevents front-running via receiveWithAuthorization)
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

        // Determine escrow period: per-settlement override or seller's default
        uint256 escrow = escrowDuration > 0
            ? _validateEscrowDuration(escrowDuration)
            : sellers[recipient].escrowDuration;

        // Store payment in escrow (funds remain in contract until released)
        payments[invoiceId] = Payment({
            payer: from,
            recipient: recipient,
            amount: received,
            token: token,
            endpoint: endpoint,
            nonce: nonce,
            expiry: validBefore,
            paidAt: block.timestamp,
            releaseAt: block.timestamp + escrow,
            released: false,
            refunded: false
        });

        emit PaymentReceived(invoiceId, from, recipient, token, received, endpoint, nonce, block.chainid);
    }

    // ─── Escrow Release ───

    /**
     * @notice Release escrowed funds to the seller after the grace period.
     *         Anyone can call this (permissionless) since it only sends to the
     *         recorded recipient. This allows batch release by third parties.
     */
    function release(bytes32 invoiceId) external nonReentrant {
        Payment storage p = payments[invoiceId];
        require(p.paidAt > 0, "X402: invoice not paid");
        require(!p.released, "X402: already released");
        require(!p.refunded, "X402: already refunded");
        require(block.timestamp >= p.releaseAt, "X402: escrow period active");

        uint256 amount = p.amount;
        address token = p.token;
        address recipient = p.recipient;

        // Mark as released before transfer (CEI)
        p.released = true;

        IERC20(token).safeTransfer(recipient, amount);
        emit PaymentReleased(invoiceId, recipient, token, amount);
    }

    /**
     * @notice Release escrowed funds to an alternative address (e.g., if the seller's
     *         primary address is blocklisted by the token). Only the original recipient
     *         (seller) can redirect the release.
     */
    function releaseTo(bytes32 invoiceId, address to) external nonReentrant {
        Payment storage p = payments[invoiceId];
        require(p.paidAt > 0, "X402: invoice not paid");
        require(!p.released, "X402: already released");
        require(!p.refunded, "X402: already refunded");
        require(block.timestamp >= p.releaseAt, "X402: escrow period active");
        require(msg.sender == p.recipient, "X402: only recipient can redirect");
        require(to != address(0), "X402: zero address");

        uint256 amount = p.amount;
        address token = p.token;

        p.released = true;

        IERC20(token).safeTransfer(to, amount);
        emit PaymentReleased(invoiceId, to, token, amount);
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
        if (p.refunded) return (false, address(0));
        if (p.amount < expectedAmount) return (false, address(0));
        if (keccak256(bytes(p.endpoint)) != keccak256(bytes(expectedEndpoint))) {
            return (false, address(0));
        }
        return (true, p.payer);
    }

    // ─── Refunds ───

    /**
     * @notice Refund a paid invoice back to the original payer.
     *         Only the payment recipient (seller) can initiate, and only
     *         during the escrow period (before release).
     *         No ERC-20 approval needed: funds are held in this contract.
     */
    function refund(bytes32 invoiceId) external nonReentrant {
        _refundTo(invoiceId, payments[invoiceId].payer);
    }

    /**
     * @notice Refund a paid invoice to the original payer's address, or to a
     *         payer-specified alternative address. Only the payment recipient
     *         (seller) can initiate. The refund recipient must be the original
     *         payer to prevent seller misredirection of funds.
     */
    function refundTo(bytes32 invoiceId, address refundRecipient) external nonReentrant {
        require(refundRecipient != address(0), "X402: zero refund recipient");
        require(refundRecipient == payments[invoiceId].payer, "X402: can only refund to payer");
        _refundTo(invoiceId, refundRecipient);
    }

    function _refundTo(bytes32 invoiceId, address refundRecipient) internal {
        Payment storage p = payments[invoiceId];
        require(p.paidAt > 0, "X402: invoice not paid");
        require(!p.released, "X402: already released");
        require(!p.refunded, "X402: already refunded");
        require(block.timestamp < p.releaseAt, "X402: escrow period ended");
        require(msg.sender == p.recipient, "X402: only recipient can refund");

        uint256 amount = p.amount;
        address token = p.token;
        address originalPayer = p.payer;

        // Mark as refunded before transfer (CEI)
        p.refunded = true;

        IERC20(token).safeTransfer(refundRecipient, amount);
        emit Refunded(invoiceId, originalPayer, token, amount, refundRecipient);
    }

    // ─── Admin (Contract Owner) ───

    /**
     * @notice Propose adding a new supported token. Activation after TOKEN_ACTIVATION_DELAY.
     * @dev Only non-fee-on-transfer, non-rebasing, ERC-3009 tokens with dynamic
     *      DOMAIN_SEPARATOR (using block.chainid) should be added.
     */
    function proposeToken(address token) external onlyOwner {
        require(token != address(0), "X402: zero token address");
        require(token.code.length > 0, "X402: token has no code");
        require(!supportedTokens[token], "X402: already supported");
        pendingTokenActivation[token] = block.timestamp + TOKEN_ACTIVATION_DELAY;
        emit TokenProposed(token, pendingTokenActivation[token]);
    }

    /**
     * @notice Activate a previously proposed token after the timelock expires.
     */
    function activateToken(address token) external onlyOwner {
        require(pendingTokenActivation[token] > 0, "X402: not proposed");
        require(block.timestamp >= pendingTokenActivation[token], "X402: timelock active");
        delete pendingTokenActivation[token];
        supportedTokens[token] = true;
        emit TokenSupported(token, true);
    }

    /**
     * @notice Remove a supported token immediately. Does not affect existing escrows.
     */
    function removeToken(address token) external onlyOwner {
        require(token != address(0), "X402: zero token address");
        supportedTokens[token] = false;
        delete pendingTokenActivation[token];
        emit TokenSupported(token, false);
    }

    /**
     * @notice Update registration fee. Set to 0 to disable.
     */
    function setRegistrationFee(uint256 fee) external onlyOwner {
        registrationFee = fee;
        emit RegistrationFeeUpdated(fee);
    }

    /**
     * @notice Withdraw collected registration fees to owner.
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "X402: no fees to withdraw");
        (bool sent, ) = owner().call{value: balance}("");
        require(sent, "X402: fee withdrawal failed");
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

    // ─── Internal Helpers ───

    /**
     * @notice Validate and normalize escrow duration.
     * @param duration Requested duration in seconds (0 = immediate release, no escrow).
     * @return Validated duration within [MIN_ESCROW_DURATION, MAX_ESCROW_DURATION].
     */
    function _validateEscrowDuration(uint256 duration) internal pure returns (uint256) {
        require(duration <= MAX_ESCROW_DURATION, "X402: escrow too long");
        return duration;
    }
}
