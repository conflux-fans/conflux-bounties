import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "connectkit";

const confluxTestnetChain = {
  id: 71,
  name: "Conflux eSpace Testnet",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evmtestnet.confluxrpc.com"] },
  },
  blockExplorers: {
    default: {
      name: "ConfluxScan",
      url: "https://evmtestnet.confluxscan.net",
    },
  },
  testnet: true,
} as const;

const confluxMainnetChain = {
  id: 1030,
  name: "Conflux eSpace",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://evm.confluxrpc.com"] },
  },
  blockExplorers: {
    default: {
      name: "ConfluxScan",
      url: "https://evm.confluxscan.io",
    },
  },
  testnet: false,
} as const;

// Default chain based on env, but both chains are always available for switching
const defaultIsMainnet = process.env.NEXT_PUBLIC_NETWORK === "mainnet";
const defaultChain = defaultIsMainnet ? confluxMainnetChain : confluxTestnetChain;

// Put the default chain first — wagmi's useChainId() returns chains[0] when no wallet is connected
const chains = defaultIsMainnet
  ? [confluxMainnetChain, confluxTestnetChain] as const
  : [confluxTestnetChain, confluxMainnetChain] as const;

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains,
    transports: {
      [confluxTestnetChain.id]: http(),
      [confluxMainnetChain.id]: http(),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
    appName: "x402 Boilerplate",
    appDescription: "Conflux eSpace x402 Payment Gateway",
  })
);

// Contract addresses per network
const CONTRACT_ADDRESSES: Record<number, `0x${string}` | undefined> = {
  71: (process.env.NEXT_PUBLIC_X402_CONTRACT_ADDRESS_TESTNET || process.env.NEXT_PUBLIC_X402_CONTRACT_ADDRESS || undefined) as `0x${string}` | undefined,
  1030: (process.env.NEXT_PUBLIC_X402_CONTRACT_ADDRESS_MAINNET || undefined) as `0x${string}` | undefined,
};

export function getContractAddress(chainId: number): `0x${string}` | undefined {
  return CONTRACT_ADDRESSES[chainId];
}

export function getChainById(chainId: number) {
  return chainId === 1030 ? confluxMainnetChain : confluxTestnetChain;
}

export { confluxTestnetChain, confluxMainnetChain, defaultChain, defaultIsMainnet };
