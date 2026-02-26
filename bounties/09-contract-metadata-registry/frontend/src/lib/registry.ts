/** Registry ABI and address. Used by all contract calls. */

export const REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ||
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const REGISTRY_IMPLEMENTATION_ADDRESS = (process.env.NEXT_PUBLIC_REGISTRY_IMPLEMENTATION_ADDRESS ||
  '') as `0x${string}`;

const OwnershipProofTuple = [
  { name: 'v', type: 'uint8' as const },
  { name: 'r', type: 'bytes32' as const },
  { name: 's', type: 'bytes32' as const },
  { name: 'nonce', type: 'uint256' as const },
  { name: 'deadline', type: 'uint256' as const },
];

const MetadataRecordTuple = [
  { name: 'contractAddress', type: 'address' as const },
  { name: 'owner', type: 'address' as const },
  { name: 'metadataCid', type: 'string' as const },
  { name: 'checksum', type: 'bytes32' as const },
  { name: 'version', type: 'uint64' as const },
  { name: 'status', type: 'uint8' as const },
  { name: 'lastUpdated', type: 'uint64' as const },
  { name: 'resolver', type: 'address' as const },
  { name: 'submitter', type: 'address' as const },
];

export const REGISTRY_ABI = [
  { inputs: [], name: 'MODERATOR_ROLE', outputs: [{ type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    name: 'hasRole',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'metadataCid', type: 'string' },
      { name: 'checksum', type: 'bytes32' },
      { components: OwnershipProofTuple, name: 'ownershipProof', type: 'tuple' },
    ],
    name: 'submitMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'newCid', type: 'string' },
      { name: 'newChecksum', type: 'bytes32' },
      { components: OwnershipProofTuple, name: 'ownershipProof', type: 'tuple' },
    ],
    name: 'updateMetadata',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'version', type: 'uint64' },
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'version', type: 'uint64' },
      { name: 'reasonCid', type: 'string' },
    ],
    name: 'reject',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'newOwner', type: 'address' },
    ],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'resolver', type: 'address' },
    ],
    name: 'setResolver',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'delegate', type: 'address' },
      { name: 'expiry', type: 'uint64' },
    ],
    name: 'addDelegate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'delegate', type: 'address' },
    ],
    name: 'removeDelegate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'contractAddress', type: 'address' }],
    name: 'getRecord',
    outputs: [{ components: MetadataRecordTuple, type: 'tuple' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'contractAddress', type: 'address' },
      { name: 'version', type: 'uint64' },
    ],
    name: 'getRecordByVersion',
    outputs: [{ components: MetadataRecordTuple, type: 'tuple' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/** Contract status: 0=None, 1=Pending, 2=Approved, 3=Rejected */
export const MetadataStatus = {
  None: 0,
  Pending: 1,
  Approved: 2,
  Rejected: 3,
} as const;

export type MetadataRecord = {
  contractAddress: `0x${string}`;
  owner: `0x${string}`;
  metadataCid: string;
  checksum: `0x${string}`;
  version: bigint;
  status: number;
  lastUpdated: bigint;
  resolver: `0x${string}`;
  submitter: `0x${string}`;
};
