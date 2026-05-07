// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MockUSDT0
 * @notice ERC-20 token with ERC-3009 (transferWithAuthorization / receiveWithAuthorization)
 *         support. Mimics USDT0's interface for testnet x402 payment flows.
 *
 *         WARNING: mint() is unrestricted — this contract is for TESTNET ONLY.
 *         On mainnet, use the real USDT0 token on Conflux eSpace.
 */
contract MockUSDT0 is ERC20 {
    using ECDSA for bytes32;

    // ─── EIP-712 ───
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");

    /// @dev Cached domain separator and chain ID for gas-efficient recomputation on fork
    bytes32 private immutable _cachedDomainSeparator;
    uint256 private immutable _cachedChainId;
    bytes32 private immutable _hashedName;
    bytes32 private immutable _hashedVersion;

    // nonce => authorizer => used
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);

    constructor() ERC20("USD Tether 0", "USDT0") {
        _hashedName = keccak256(bytes("USD Tether 0"));
        _hashedVersion = keccak256(bytes("1"));
        _cachedChainId = block.chainid;
        _cachedDomainSeparator = _computeDomainSeparator();
    }

    /**
     * @notice Returns the EIP-712 domain separator, recomputing dynamically if
     *         the chain ID has changed (e.g., after a hard fork).
     */
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        if (block.chainid == _cachedChainId) {
            return _cachedDomainSeparator;
        }
        return _computeDomainSeparator();
    }

    function _computeDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                _hashedName,
                _hashedVersion,
                block.chainid,
                address(this)
            )
        );
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens for testing — anyone can call on testnet
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Execute a transfer with a signed authorization (ERC-3009).
     * @dev The facilitator/relayer calls this function, paying the gas.
     *      The `from` user only signs an off-chain EIP-712 message.
     *      Uses ECDSA.recover() which enforces low-s to prevent signature malleability.
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp > validAfter, "USDT0: auth not yet valid");
        require(block.timestamp < validBefore, "USDT0: auth expired");
        require(!authorizationState[from][nonce], "USDT0: auth already used");

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from, to, value, validAfter, validBefore, nonce
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash)
        );

        address recovered = ECDSA.recover(digest, v, r, s);
        require(recovered == from, "USDT0: invalid signature");

        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        _transfer(from, to, value);
    }

    /**
     * @notice Same as transferWithAuthorization but requires msg.sender == to.
     *         This prevents front-running by ensuring only the intended recipient
     *         can submit the authorization.
     */
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
    ) external {
        require(to == msg.sender, "USDT0: caller must be payee");
        require(block.timestamp > validAfter, "USDT0: auth not yet valid");
        require(block.timestamp < validBefore, "USDT0: auth expired");
        require(!authorizationState[from][nonce], "USDT0: auth already used");

        bytes32 structHash = keccak256(
            abi.encode(
                RECEIVE_WITH_AUTHORIZATION_TYPEHASH,
                from, to, value, validAfter, validBefore, nonce
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash)
        );

        address recovered = ECDSA.recover(digest, v, r, s);
        require(recovered == from, "USDT0: invalid signature");

        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);

        _transfer(from, to, value);
    }

    /**
     * @notice Cancel an authorization before it is used.
     */
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(!authorizationState[authorizer][nonce], "USDT0: auth already used");

        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("CancelAuthorization(address authorizer,bytes32 nonce)"),
                authorizer, nonce
            )
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash)
        );

        address recovered = ECDSA.recover(digest, v, r, s);
        require(recovered == authorizer, "USDT0: invalid signature");

        authorizationState[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }
}
