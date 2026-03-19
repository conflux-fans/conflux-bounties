// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IMetadataRegistry {
    enum MetadataStatus {
        None,
        Pending,
        Approved,
        Rejected
    }

    struct MetadataRecord {
        address contractAddress;
        address owner;
        string metadataCid;
        bytes32 checksum;
        uint64 version;
        MetadataStatus status;
        uint64 lastUpdated;
        address resolver;
        address submitter;
    }

    struct OwnershipProof {
        uint8 v;
        bytes32 r;
        bytes32 s;
        uint256 nonce;
        uint256 deadline;
    }

    event MetadataSubmitted(
        address indexed contractAddress,
        uint64 indexed version,
        address indexed submitter,
        string metadataCid,
        bytes32 checksum
    );

    event MetadataApproved(
        address indexed contractAddress,
        uint64 indexed version,
        address indexed moderator
    );

    event MetadataRejected(
        address indexed contractAddress,
        uint64 indexed version,
        address indexed moderator,
        string reasonCid
    );

    event MetadataUpdated(
        address indexed contractAddress,
        uint64 indexed version,
        address indexed submitter,
        string metadataCid,
        bytes32 checksum
    );

    event ResolverSet(
        address indexed contractAddress,
        address indexed resolver
    );

    event OwnershipTransferredForContract(
        address indexed contractAddress,
        address indexed previousOwner,
        address indexed newOwner
    );

    event DelegateAdded(
        address indexed contractAddress,
        address indexed delegate,
        uint64 expiry
    );

    event DelegateRemoved(
        address indexed contractAddress,
        address indexed delegate
    );

    event NonceUsed(
        address indexed signer,
        uint256 indexed nonce
    );

    error NotContractOwner();
    error NotAuthorizedModerator();
    error InvalidStatusTransition();
    error VersionMismatch();
    error SignatureExpired();
    error SignatureReplay();
    error InvalidSignature();
    error InvalidContractAddress();
    error DelegateExpired();
    error ZeroAddress();
    error NotDelegateOrOwner();
    error AlreadyApproved();
    error RecordNotFound();

    function submitMetadata(
        address contractAddress,
        string calldata metadataCid,
        bytes32 checksum,
        OwnershipProof calldata ownershipProof
    ) external;

    function approve(address contractAddress, uint64 version) external;

    function reject(
        address contractAddress,
        uint64 version,
        string calldata reasonCid
    ) external;

    function updateMetadata(
        address contractAddress,
        string calldata newCid,
        bytes32 newChecksum,
        OwnershipProof calldata ownershipProof
    ) external;

    function transferOwnership(
        address contractAddress,
        address newOwner
    ) external;

    function setResolver(
        address contractAddress,
        address resolver
    ) external;

    function addDelegate(
        address contractAddress,
        address delegate,
        uint64 expiry
    ) external;

    function removeDelegate(
        address contractAddress,
        address delegate
    ) external;

    function getRecord(
        address contractAddress
    ) external view returns (MetadataRecord memory);

    function getRecordByVersion(
        address contractAddress,
        uint64 version
    ) external view returns (MetadataRecord memory);
}
