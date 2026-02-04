export const registryAbi = [
  {
    inputs: [
      { internalType: "address", name: "contractAddr", type: "address" },
      { internalType: "string", name: "metadataCid", type: "string" },
      { internalType: "bytes32", name: "contentHash", type: "bytes32" },
    ],
    name: "submitMetadata",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "contractAddr", type: "address" }],
    name: "approve",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "contractAddr", type: "address" },
      { internalType: "string", name: "reason", type: "string" },
    ],
    name: "reject",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "contractAddr", type: "address" }],
    name: "getRecord",
    outputs: [
      {
        components: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "string", name: "metadataCid", type: "string" },
          { internalType: "bytes32", name: "contentHash", type: "bytes32" },
          { internalType: "uint64", name: "version", type: "uint64" },
          { internalType: "uint8", name: "status", type: "uint8" },
          { internalType: "uint64", name: "lastUpdated", type: "uint64" },
        ],
        internalType: "struct IContractMetadataRegistry.MetadataRecord",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "contractAddr", type: "address" },
      { internalType: "address", name: "delegate", type: "address" },
    ],
    name: "isDelegate",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "MODERATOR_ROLE",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes32", name: "role", type: "bytes32" },
      { internalType: "address", name: "account", type: "address" },
    ],
    name: "hasRole",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
