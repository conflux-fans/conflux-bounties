// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./interfaces/IMetadataRegistry.sol";
contract MetadataRegistry is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    OwnableUpgradeable,
    EIP712Upgradeable,
    IMetadataRegistry
{
    using ECDSA for bytes32;

    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    bytes32 private constant SUBMISSION_TYPEHASH =
        keccak256(
            "Submission(address contractAddress,string metadataCid,bytes32 checksum,uint256 nonce,uint256 deadline)"
        );

    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    struct ContractMetadataState {
        uint64 currentVersion;
        address currentOwner;
        address resolver;
        mapping(uint64 => MetadataRecord) versions;
    }

    struct DelegateInfo {
        uint64 expiry;
        bool active;
    }

    mapping(address => mapping(address => DelegateInfo)) private _delegates;

    mapping(address => ContractMetadataState) private _registry;

    constructor() {
        _disableInitializers();
    }

    function initialize(address admin, address moderator) public initializer {
        __AccessControl_init();
        __Ownable_init(admin);
        __UUPSUpgradeable_init();
        __EIP712_init("ConfluxMetadataRegistry", "1");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE, admin);
        _grantRole(MODERATOR_ROLE, moderator);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(UPGRADER_ROLE) {}

    function submitMetadata(
        address contractAddress,
        string calldata metadataCid,
        bytes32 checksum,
        OwnershipProof calldata ownershipProof
    ) external override {
        _requireValidContract(contractAddress);
        _verifyOwnership(contractAddress, metadataCid, checksum, ownershipProof);

        _recordSubmission(contractAddress, metadataCid, checksum);
    }

    function approve(address contractAddress, uint64 version) external override onlyRole(MODERATOR_ROLE) {
        ContractMetadataState storage state = _registry[contractAddress];
        MetadataRecord storage record = state.versions[version];

        if (record.status == MetadataStatus.Approved) revert AlreadyApproved();
        if (record.version == 0) revert RecordNotFound();

        record.status = MetadataStatus.Approved;
        record.lastUpdated = uint64(block.timestamp);

        emit MetadataApproved(contractAddress, version, msg.sender);
        emit MetadataUpdated(
            contractAddress,
            version,
            record.submitter,
            record.metadataCid,
            record.checksum
        );
    }

    function reject(
        address contractAddress,
        uint64 version,
        string calldata reasonCid
    ) external override onlyRole(MODERATOR_ROLE) {
        ContractMetadataState storage state = _registry[contractAddress];
        MetadataRecord storage record = state.versions[version];

        if (record.version == 0) revert RecordNotFound();

        record.status = MetadataStatus.Rejected;
        record.lastUpdated = uint64(block.timestamp);

        emit MetadataRejected(contractAddress, version, msg.sender, reasonCid);
    }

    function updateMetadata(
        address contractAddress,
        string calldata newCid,
        bytes32 newChecksum,
        OwnershipProof calldata ownershipProof
    ) external override {
        _requireValidContract(contractAddress);
        _verifyOwnership(contractAddress, newCid, newChecksum, ownershipProof);

        _recordSubmission(contractAddress, newCid, newChecksum);
    }

    function transferOwnership(
        address contractAddress,
        address newOwner
    ) external override {
        if (newOwner == address(0)) revert ZeroAddress();

        ContractMetadataState storage state = _registry[contractAddress];
        address currentOwner = state.currentOwner;

        if (currentOwner == address(0)) {
            currentOwner = _readOwnerFromContract(contractAddress);
        }

        if (msg.sender != currentOwner) revert NotContractOwner();

        state.currentOwner = newOwner;

        emit OwnershipTransferredForContract(contractAddress, currentOwner, newOwner);
    }

    function setResolver(
        address contractAddress,
        address resolver
    ) external override {
        ContractMetadataState storage state = _registry[contractAddress];
        address ownerForContract = _getOwnerForContract(contractAddress);

        if (msg.sender != ownerForContract) revert NotContractOwner();

        state.resolver = resolver;

        emit ResolverSet(contractAddress, resolver);
    }

    function addDelegate(
        address contractAddress,
        address delegate,
        uint64 expiry
    ) external override {
        if (delegate == address(0)) revert ZeroAddress();
        address ownerForContract = _getOwnerForContract(contractAddress);
        if (msg.sender != ownerForContract) revert NotContractOwner();

        _delegates[contractAddress][delegate] = DelegateInfo({expiry: expiry, active: true});

        emit DelegateAdded(contractAddress, delegate, expiry);
    }

    function removeDelegate(
        address contractAddress,
        address delegate
    ) external override {
        address ownerForContract = _getOwnerForContract(contractAddress);
        if (msg.sender != ownerForContract) revert NotContractOwner();

        delete _delegates[contractAddress][delegate];

        emit DelegateRemoved(contractAddress, delegate);
    }

    function getRecord(
        address contractAddress
    ) external view override returns (MetadataRecord memory) {
        ContractMetadataState storage state = _registry[contractAddress];
        return state.versions[state.currentVersion];
    }

    function getRecordByVersion(
        address contractAddress,
        uint64 version
    ) external view override returns (MetadataRecord memory) {
        ContractMetadataState storage state = _registry[contractAddress];
        return state.versions[version];
    }

    function _recordSubmission(
        address contractAddress,
        string calldata metadataCid,
        bytes32 checksum
    ) internal {
        ContractMetadataState storage state = _registry[contractAddress];

        uint64 newVersion = state.currentVersion + 1;
        state.currentVersion = newVersion;

        if (state.currentOwner == address(0)) {
            state.currentOwner = _readOwnerFromContract(contractAddress);
        }

        MetadataRecord storage record = state.versions[newVersion];
        record.contractAddress = contractAddress;
        record.owner = state.currentOwner;
        record.metadataCid = metadataCid;
        record.checksum = checksum;
        record.version = newVersion;
        record.status = MetadataStatus.Pending;
        record.lastUpdated = uint64(block.timestamp);
        record.resolver = state.resolver;
        record.submitter = msg.sender;

        emit MetadataSubmitted(contractAddress, newVersion, msg.sender, metadataCid, checksum);
    }

    function _verifyOwnership(
        address contractAddress,
        string calldata metadataCid,
        bytes32 checksum,
        OwnershipProof calldata ownershipProof
    ) internal {
        address ownerFromContract = _readOwnerFromContract(contractAddress);

        if (
            msg.sender == ownerFromContract ||
            _isActiveDelegate(contractAddress, msg.sender)
        ) {
            return;
        }

        if (ownershipProof.deadline < block.timestamp) {
            revert SignatureExpired();
        }

        bytes32 structHash = keccak256(
            abi.encode(
                SUBMISSION_TYPEHASH,
                contractAddress,
                keccak256(bytes(metadataCid)),
                checksum,
                ownershipProof.nonce,
                ownershipProof.deadline
            )
        );

        bytes32 hashTyped = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hashTyped, ownershipProof.v, ownershipProof.r, ownershipProof.s);

        if (_usedNonces[signer][ownershipProof.nonce]) {
            revert SignatureReplay();
        }

        bool signerIsOwner = signer == ownerFromContract;
        bool signerIsDelegate = _isActiveDelegate(contractAddress, signer);

        if (!signerIsOwner && !signerIsDelegate) {
            revert InvalidSignature();
        }

        _usedNonces[signer][ownershipProof.nonce] = true;
        emit NonceUsed(signer, ownershipProof.nonce);
    }

    function _readOwnerFromContract(address target) internal view returns (address) {
        (bool success, bytes memory data) = target.staticcall(abi.encodeWithSignature("owner()"));
        if (!success || data.length == 0) revert NotContractOwner();

        address owner = abi.decode(data, (address));
        if (owner == address(0)) revert NotContractOwner();

        return owner;
    }

    function _isActiveDelegate(address contractAddress, address delegate) internal view returns (bool) {
        DelegateInfo memory info = _delegates[contractAddress][delegate];
        if (!info.active) return false;
        if (info.expiry != 0 && info.expiry < block.timestamp) return false;
        return true;
    }

    function _getOwnerForContract(address contractAddress) internal view returns (address) {
        ContractMetadataState storage state = _registry[contractAddress];
        if (state.currentOwner != address(0)) {
            return state.currentOwner;
        }
        return _readOwnerFromContract(contractAddress);
    }

    function _requireValidContract(address contractAddress) internal pure {
        if (contractAddress == address(0)) revert InvalidContractAddress();
    }

    uint256[45] private __gap;
}

