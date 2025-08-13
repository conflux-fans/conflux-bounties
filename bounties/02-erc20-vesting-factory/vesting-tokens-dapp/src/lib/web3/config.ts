// src/lib/web3/config.ts
import { http, createConfig } from "wagmi";
import { sepolia, mainnet, confluxESpace, confluxESpaceTestnet } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// Export chains separately for RainbowKit
export const chains = [sepolia, mainnet,confluxESpace,confluxESpaceTestnet] as const;

// Create wagmi config using RainbowKit's getDefaultConfig
export const config = getDefaultConfig({
  appName: "Token Vesting DApp",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
  chains: chains,
  ssr: true, // If using SSR
});

// Contract addresses
export const CONTRACT_ADDRESSES: Record<number, { FACTORY: string }> = {
  [mainnet.id]: {
    FACTORY: process.env.NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS || "",
  },
  // Sepolia
  [sepolia.id]: {
    FACTORY:
      process.env.NEXT_PUBLIC_SEPOLIA_FACTORY_ADDRESS ||
      "0x1121C77E3AcC2281982AD91c53702A71E56d6Cd2",
  },
} as const;

// Get factory address for current chain
export const getFactoryAddress = (chainId: number): `0x${string}` => {
  const address = CONTRACT_ADDRESSES[chainId]?.FACTORY;
  if (!address) {
    throw new Error(`Factory contract not deployed on chain ${chainId}`);
  }
  return address as `0x${string}`;
};

// Chain configuration with explorer URLs
export const CHAIN_INFO: Record<
  number,
  {
    name: string;
    explorer: string;
    rpc?: string;
  }
> = {
  [mainnet.id]: {
    name: "Ethereum Mainnet",
    explorer: "https://etherscan.io",
    rpc: `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  },
  [sepolia.id]: {
    name: "Sepolia Testnet",
    explorer: "https://sepolia.etherscan.io",
    rpc: `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
  },
};

// Helper functions
export const getExplorerUrl = (chainId: number): string => {
  return CHAIN_INFO[chainId]?.explorer || "https://etherscan.io";
};

export const getExplorerAddressUrl = (
  chainId: number,
  address: string
): string => {
  const explorer = getExplorerUrl(chainId);
  return `${explorer}/address/${address}`;
};

export const getExplorerTxUrl = (chainId: number, txHash: string): string => {
  const explorer = getExplorerUrl(chainId);
  return `${explorer}/tx/${txHash}`;
};

export const getChainName = (chainId: number): string => {
  return CHAIN_INFO[chainId]?.name || "Unknown Chain";
};

// Default chain
export const DEFAULT_CHAIN = sepolia;

export {
  TOKEN_VESTING_FACTORY_ABI,
  VESTED_TOKEN_ABI,
  TOKEN_VESTING_ABI,
  ERC20_ABI,
} from "./ABIs";
