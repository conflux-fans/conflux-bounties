// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IContractMetadataRegistry
 * @notice Interface for the Contract Metadata Registry on Conflux eSpace.
 *         Allows contract owners to submit IPFS-pinned metadata (ABI, compiler
 *         info, description, etc.) and moderators to approve or reject entries.
 */
interface IContractMetadataRegistry {
    /** Enums */

    enum Status {
        None,
        Pending,
        Approved,
        Rejected
    }

    /** Structs */

    struct MetadataRecord {
        address owner;
        string metadataCid;
        bytes32 contentHash;
        uint64 version;
        Status status;
        uint64 lastUpdated;
    }

    /** Events */

    event MetadataSubmitted(
        address indexed contractAddr,
        address indexed owner,
        string metadataCid,
        bytes32 contentHash,
        uint64 version
    );

    event MetadataApproved(address indexed contractAddr, address indexed moderator);

    event MetadataRejected(
        address indexed contractAddr,
        address indexed moderator,
        string reason
    );

    event RecordOwnershipTransferred(
        address indexed contractAddr,
        address indexed previousOwner,
        address indexed newOwner
    );

    event DelegateSet(
        address indexed contractAddr,
        address indexed delegate,
        bool allowed
    );

    event ResolverSet(address indexed contractAddr, address indexed resolver);

    /** Write Functions */

    /**
     * @notice Submit or update metadata for a contract.
     * @dev    First call sets msg.sender as owner. Subsequent calls require
     *         msg.sender to be the owner or an approved delegate.
     *         Resets status to Pending and increments version.
     * @param contractAddr The target contract address.
     * @param metadataCid  IPFS CID of the JSON metadata blob.
     * @param contentHash  keccak256 of the canonical JSON for integrity.
     */
    function submitMetadata(
        address contractAddr,
        string calldata metadataCid,
        bytes32 contentHash
    ) external;

    /**
     * @notice Approve a pending metadata submission.
     * @dev    Callable only by addresses with MODERATOR_ROLE.
     * @param contractAddr The contract whose metadata to approve.
     */
    function approve(address contractAddr) external;

    /**
     * @notice Reject a pending metadata submission with a reason.
     * @dev    Callable only by addresses with MODERATOR_ROLE.
     * @param contractAddr The contract whose metadata to reject.
     * @param reason       Human-readable rejection reason.
     */
    function reject(address contractAddr, string calldata reason) external;

    /**
     * @notice Transfer record ownership to a new address.
     * @dev    Only callable by the current record owner.
     * @param contractAddr The contract whose record ownership to transfer.
     * @param newOwner     The new owner address.
     */
    function transferRecordOwnership(address contractAddr, address newOwner) external;

    /**
     * @notice Grant or revoke delegate permissions for a contract record.
     * @dev    Only callable by the record owner. Delegates may submit metadata
     *         on behalf of the owner (useful for multisig / team workflows).
     * @param contractAddr The contract address.
     * @param delegate     The delegate address.
     * @param allowed      True to grant, false to revoke.
     */
    function setDelegate(address contractAddr, address delegate, bool allowed) external;

    /**
     * @notice Set a custom resolver contract for a metadata record.
     * @dev    Callable by owner or delegate.
     * @param contractAddr The contract address.
     * @param resolver     The resolver contract address (address(0) to unset).
     */
    function setResolver(address contractAddr, address resolver) external;

    /** Read Functions */

    /**
     * @notice Retrieve the full metadata record for a contract.
     * @param contractAddr The contract address to look up.
     * @return The MetadataRecord struct.
     */
    function getRecord(address contractAddr) external view returns (MetadataRecord memory);

    /**
     * @notice Check if an address is a delegate for a contract record.
     * @param contractAddr The contract address.
     * @param delegate     The address to check.
     * @return True if the address is an approved delegate.
     */
    function isDelegate(address contractAddr, address delegate) external view returns (bool);

    /**
     * @notice Get the resolver address for a contract record.
     * @param contractAddr The contract address.
     * @return The resolver address (address(0) if none set).
     */
    function getResolver(address contractAddr) external view returns (address);
}
