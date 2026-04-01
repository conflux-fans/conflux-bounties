/** ABI for X402PaymentVerifier (multi-tenant facilitator contract) */
export const verifierAbi = [
  // ─── Settlement ───
  {
    type: "function",
    name: "settle",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "recipient", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "endpoint", type: "string" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ─── Verification ───
  {
    type: "function",
    name: "verifyPayment",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "expectedAmount", type: "uint256" },
      { name: "expectedEndpoint", type: "string" },
    ],
    outputs: [
      { name: "valid", type: "bool" },
      { name: "payer", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getPayment",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "payer", type: "address" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "token", type: "address" },
          { name: "endpoint", type: "string" },
          { name: "nonce", type: "bytes32" },
          { name: "expiry", type: "uint256" },
          { name: "paidAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usedNonces",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // ─── Refund ───
  {
    type: "function",
    name: "refund",
    inputs: [{ name: "invoiceId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "refundTo",
    inputs: [
      { name: "invoiceId", type: "bytes32" },
      { name: "refundRecipient", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ─── Seller Registry ───
  {
    type: "function",
    name: "registerSeller",
    inputs: [
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateSeller",
    inputs: [
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deactivateSeller",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reactivateSeller",
    inputs: [
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getSeller",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "wallet", type: "address" },
          { name: "apiBaseUrl", type: "string" },
          { name: "description", type: "string" },
          { name: "active", type: "bool" },
          { name: "registeredAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getSellerCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getActiveSellers",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "wallet", type: "address" },
          { name: "apiBaseUrl", type: "string" },
          { name: "description", type: "string" },
          { name: "active", type: "bool" },
          { name: "registeredAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  // ─── Admin ───
  {
    type: "function",
    name: "setSupportedToken",
    inputs: [
      { name: "token", type: "address" },
      { name: "supported", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "supportedTokens",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  // ─── Events ───
  {
    type: "event",
    name: "PaymentReceived",
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "recipient", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "endpoint", type: "string", indexed: false },
      { name: "nonce", type: "bytes32", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Refunded",
    inputs: [
      { name: "invoiceId", type: "bytes32", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SellerRegistered",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "apiBaseUrl", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SellerUpdated",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "apiBaseUrl", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SellerDeactivated",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "TokenSupported",
    inputs: [
      { name: "token", type: "address", indexed: true },
      { name: "supported", type: "bool", indexed: false },
    ],
  },
] as const;

/** ABI for ERC-3009 tokens (USDT0, AxCNH) */
export const erc3009Abi = [
  {
    type: "function",
    name: "receiveWithAuthorization",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "authorizationState",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "name",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

// Re-export for backwards compat
export const abi = verifierAbi;
