// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./interfaces/IContractMetadataRegistry.sol";

/**
 * @title ContractMetadataRegistry
 * @notice UUPS-upgradeable registry that maps Conflux eSpace contract addresses
 *         to IPFS metadata CIDs. Supports ownership, delegates, moderation, and
 *         optional custom resolvers.
 */
contract ContractMetadataRegistry is
    Initializable,
    OwnableUpgradeable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IContractMetadataRegistry
{
    /** Constants */

    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    /** State */

    /// @dev contractAddr => MetadataRecord
    mapping(address => MetadataRecord) private _records;

    /// @dev contractAddr => delegate => allowed
    mapping(address => mapping(address => bool)) private _delegates;

    /// @dev contractAddr => resolver
    mapping(address => address) private _resolvers;

    /// @dev Reserved storage gap for future upgrades
    uint256[47] private __gap;

    /** Modifiers */

    modifier onlyRecordOwnerOrDelegate(address contractAddr) {
        MetadataRecord storage record = _records[contractAddr];
        require(
            record.owner == msg.sender || _delegates[contractAddr][msg.sender],
            "NotOwnerOrDelegate"
        );
        _;
    }

    modifier onlyRecordOwner(address contractAddr) {
        require(_records[contractAddr].owner == msg.sender, "NotRecordOwner");
        _;
    }

    /** Initializer (replaces constructor for UUPS) */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the registry with an owner and a first moderator.
     * @param _owner     The contract admin / upgrade authority.
     * @param _moderator The first moderator address.
     */
    function initialize(address _owner, address _moderator) external initializer {
        require(_owner != address(0), "ZeroOwner");
        require(_moderator != address(0), "ZeroModerator");

        __Ownable_init(_owner);
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(MODERATOR_ROLE, _moderator);
    }

    /** Write Functions */

    /// @inheritdoc IContractMetadataRegistry
    function submitMetadata(
        address contractAddr,
        string calldata metadataCid,
        bytes32 contentHash
    ) external {
        require(contractAddr != address(0), "ZeroAddress");
        require(bytes(metadataCid).length > 0, "EmptyCid");
        require(contentHash != bytes32(0), "EmptyHash");

        MetadataRecord storage record = _records[contractAddr];

        if (record.owner == address(0)) {
            // First submission — caller becomes owner
            record.owner = msg.sender;
        } else {
            // Subsequent submissions — must be owner or delegate
            require(
                record.owner == msg.sender || _delegates[contractAddr][msg.sender],
                "NotOwnerOrDelegate"
            );
        }

        record.metadataCid = metadataCid;
        record.contentHash = contentHash;
        record.version += 1;
        record.status = Status.Pending;
        record.lastUpdated = uint64(block.timestamp);

        emit MetadataSubmitted(contractAddr, record.owner, metadataCid, contentHash, record.version);
    }

    /// @inheritdoc IContractMetadataRegistry
    function approve(address contractAddr) external onlyRole(MODERATOR_ROLE) {
        MetadataRecord storage record = _records[contractAddr];
        require(record.status == Status.Pending, "NotPending");

        record.status = Status.Approved;
        record.lastUpdated = uint64(block.timestamp);

        emit MetadataApproved(contractAddr, msg.sender);
    }

    /// @inheritdoc IContractMetadataRegistry
    function reject(address contractAddr, string calldata reason) external onlyRole(MODERATOR_ROLE) {
        MetadataRecord storage record = _records[contractAddr];
        require(record.status == Status.Pending, "NotPending");
        require(bytes(reason).length > 0, "EmptyReason");

        record.status = Status.Rejected;
        record.lastUpdated = uint64(block.timestamp);

        emit MetadataRejected(contractAddr, msg.sender, reason);
    }

    /// @inheritdoc IContractMetadataRegistry
    function transferRecordOwnership(
        address contractAddr,
        address newOwner
    ) external onlyRecordOwner(contractAddr) {
        require(newOwner != address(0), "ZeroNewOwner");

        address previousOwner = _records[contractAddr].owner;
        _records[contractAddr].owner = newOwner;

        emit RecordOwnershipTransferred(contractAddr, previousOwner, newOwner);
    }

    /// @inheritdoc IContractMetadataRegistry
    function setDelegate(
        address contractAddr,
        address delegate,
        bool allowed
    ) external onlyRecordOwner(contractAddr) {
        require(delegate != address(0), "ZeroDelegate");

        _delegates[contractAddr][delegate] = allowed;

        emit DelegateSet(contractAddr, delegate, allowed);
    }

    /// @inheritdoc IContractMetadataRegistry
    function setResolver(
        address contractAddr,
        address resolver
    ) external onlyRecordOwnerOrDelegate(contractAddr) {
        _resolvers[contractAddr] = resolver;

        emit ResolverSet(contractAddr, resolver);
    }

    /** Read Functions */

    /// @inheritdoc IContractMetadataRegistry
    function getRecord(address contractAddr) external view returns (MetadataRecord memory) {
        return _records[contractAddr];
    }

    /// @inheritdoc IContractMetadataRegistry
    function isDelegate(address contractAddr, address delegate) external view returns (bool) {
        return _delegates[contractAddr][delegate];
    }

    /// @inheritdoc IContractMetadataRegistry
    function getResolver(address contractAddr) external view returns (address) {
        return _resolvers[contractAddr];
    }

    /** Internal — UUPS */

    /// @dev Only the contract owner can authorize an upgrade.
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
