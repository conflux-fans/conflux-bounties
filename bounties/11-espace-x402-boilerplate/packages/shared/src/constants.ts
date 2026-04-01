// ─── Network type ───
export type Network = "testnet" | "mainnet";

// ─── Token addresses ───
// Mainnet ERC-3009 tokens on Conflux eSpace (chain 1030)
// Verified on-chain: these contracts expose DOMAIN_SEPARATOR(), name(), version()
export const USDT0_MAINNET = "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff";
export const CNHT0_MAINNET = "0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e";

// Testnet MockUSDT0 — deployed via Hardhat, set via env or after deploy
export const USDT0_TESTNET = process.env.USDT0_ADDRESS || "0x0000000000000000000000000000000000000000";

// Default token for x402 payments (USDT0)
export const DEFAULT_PAYMENT_TOKEN = USDT0_TESTNET;

// Token decimals (USDT0 = 6, CNHT0 = 6)
export const TOKEN_DECIMALS = 6;

// ─── Supported tokens registry ───
// EIP-712 domain parameters — MUST match on-chain contract values exactly.
// Verified by querying name(), version(), and DOMAIN_SEPARATOR() on mainnet.
// MockUSDT0 (testnet) uses "USD Tether 0" v1 (set in MockUSDT0.sol constructor).
export const SUPPORTED_TOKENS = [
  {
    symbol: "USDT0",
    name: "USD₮0",
    decimals: 6,
    mainnet: USDT0_MAINNET,
    testnet: USDT0_TESTNET,
    domainName: "USDT0",           // on-chain name() = "USDT0"
    domainVersion: "1",            // on-chain verified via DOMAIN_SEPARATOR
    testnetDomainName: "USD Tether 0", // MockUSDT0.sol uses this
    testnetDomainVersion: "1",
    description: "Tether USD stablecoin (ERC-3009 enabled)",
    explorerUrl: `https://evm.confluxscan.io/token/${USDT0_MAINNET}`,
  },
  {
    symbol: "CNHT0",
    name: "CNH₮0",
    decimals: 6,
    mainnet: CNHT0_MAINNET,
    testnet: null, // no testnet deployment
    domainName: "AxCNH",           // on-chain name() = "AxCNH"
    domainVersion: "2",            // on-chain version() = "2"
    testnetDomainName: null,
    testnetDomainVersion: null,
    description: "Tether offshore Chinese Yuan stablecoin (ERC-3009 enabled)",
    explorerUrl: `https://evm.confluxscan.io/token/${CNHT0_MAINNET}`,
  },
] as const;

export const CONFLUX_ESPACE_TESTNET = {
  chainId: 71,
  name: "Conflux eSpace Testnet",
  rpcUrl: "https://evmtestnet.confluxrpc.com",
  explorerUrl: "https://evmtestnet.confluxscan.net",
  faucetUrl: "https://efaucet.confluxnetwork.org/",
} as const;

export const CONFLUX_ESPACE_MAINNET = {
  chainId: 1030,
  name: "Conflux eSpace",
  rpcUrl: "https://evm.confluxrpc.com",
  explorerUrl: "https://evm.confluxscan.io",
} as const;

// ─── Network configuration ───
// Single source of truth: set NETWORK=testnet|mainnet in .env.
// All chain, RPC, token, and explorer values derive from this.
// Individual env vars (CONFLUX_RPC_URL, USDT0_ADDRESS) override if set.

export interface NetworkConfig {
  network: Network;
  chainId: number;
  chainName: string;
  rpcUrl: string;
  explorerUrl: string;
  faucetUrl?: string;
  /** Primary payment token address for this network */
  paymentToken: string;
  /** All supported token addresses for this network */
  supportedTokens: Array<{ symbol: string; address: string; domainName: string; domainVersion: string }>;
  /** Whether this is a testnet (affects UI warnings, gas costs) */
  isTestnet: boolean;
}

export function getNetworkConfig(networkOverride?: Network): NetworkConfig {
  const network: Network = networkOverride
    || (process.env.NEXT_PUBLIC_NETWORK as Network)
    || (process.env.NETWORK as Network)
    || "testnet";

  if (network === "mainnet") {
    const rpcUrl = process.env.CONFLUX_RPC_URL || CONFLUX_ESPACE_MAINNET.rpcUrl;
    return {
      network: "mainnet",
      chainId: CONFLUX_ESPACE_MAINNET.chainId,
      chainName: CONFLUX_ESPACE_MAINNET.name,
      rpcUrl,
      explorerUrl: CONFLUX_ESPACE_MAINNET.explorerUrl,
      paymentToken: USDT0_MAINNET,
      supportedTokens: [
        { symbol: "USDT0", address: USDT0_MAINNET, domainName: "USDT0", domainVersion: "1" },
        { symbol: "CNHT0", address: CNHT0_MAINNET, domainName: "AxCNH", domainVersion: "2" },
      ],
      isTestnet: false,
    };
  }

  // Testnet
  const rpcUrl = process.env.CONFLUX_RPC_URL || CONFLUX_ESPACE_TESTNET.rpcUrl;
  const tokenAddress = process.env.USDT0_ADDRESS || USDT0_TESTNET;
  return {
    network: "testnet",
    chainId: CONFLUX_ESPACE_TESTNET.chainId,
    chainName: CONFLUX_ESPACE_TESTNET.name,
    rpcUrl,
    explorerUrl: CONFLUX_ESPACE_TESTNET.explorerUrl,
    faucetUrl: CONFLUX_ESPACE_TESTNET.faucetUrl,
    paymentToken: tokenAddress,
    supportedTokens: [
      { symbol: "USDT0", address: tokenAddress, domainName: "USD Tether 0", domainVersion: "1" },
    ],
    isTestnet: true,
  };
}

export const X402_HEADERS = {
  AMOUNT: "x-payment-amount",
  TOKEN: "x-payment-token",
  NONCE: "x-payment-nonce",
  EXPIRY: "x-payment-expiry",
  ENDPOINT: "x-payment-endpoint",
  INVOICE_ID: "x-payment-invoice-id",
  DESCRIPTION: "x-payment-description",
  RECIPIENT: "x-payment-recipient",
  VERIFIER: "x-payment-verifier",
} as const;

export const INVOICE_EXPIRY_SECONDS = 300; // 5 minutes

// Prices in USDT0 smallest unit (6 decimals). 1 USDT0 = 1_000_000
export const DEFAULT_PRICING: Record<string, string> = {
  "/data/premium": "100000",   // 0.10 USDT0
  "/compute/simulate": "500000", // 0.50 USDT0
};

export const RATE_LIMITS = {
  FREE_RPM: 60,
  PREMIUM_RPM: 120,
  AGENT_RPM: 30,
} as const;

// EIP-712 domain for ReceiveWithAuthorization signing.
// Default is MockUSDT0 (testnet). For mainnet, use getERC3009Domain().
export const ERC3009_DOMAIN = {
  name: "USD Tether 0",
  version: "1",
} as const;

/**
 * Look up the correct EIP-712 domain for a token address.
 * Critical for mainnet: the domain name/version must match the on-chain
 * contract exactly, or receiveWithAuthorization will revert.
 */
export function getERC3009Domain(
  tokenAddress: string,
  network?: Network,
): { name: string; version: string } {
  const net = network
    || (process.env.NEXT_PUBLIC_NETWORK as Network)
    || (process.env.NETWORK as Network)
    || "testnet";

  const addr = tokenAddress.toLowerCase();

  for (const token of SUPPORTED_TOKENS) {
    if (net === "mainnet" && token.mainnet?.toLowerCase() === addr) {
      return { name: token.domainName, version: token.domainVersion };
    }
    if (net === "testnet" && token.testnet?.toLowerCase() === addr) {
      return {
        name: token.testnetDomainName ?? token.domainName,
        version: token.testnetDomainVersion ?? token.domainVersion,
      };
    }
  }

  // Fallback: testnet MockUSDT0 default
  return { name: ERC3009_DOMAIN.name, version: ERC3009_DOMAIN.version };
}

export const RECEIVE_WITH_AUTHORIZATION_TYPES = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** @deprecated Use RECEIVE_WITH_AUTHORIZATION_TYPES — kept for migration only */
export const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;
