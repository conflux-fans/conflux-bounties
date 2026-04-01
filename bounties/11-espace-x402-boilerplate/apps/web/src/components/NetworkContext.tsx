"use client";

import { createContext, useContext } from "react";
import { useChainId } from "wagmi";
import { getContractAddress } from "@/lib/wagmi";

interface NetworkConfig {
  isTestnet: boolean;
  chainId: number;
  chainName: string;
  explorerUrl: string;
  contractAddress: `0x${string}` | undefined;
  paymentToken: string;
  serviceWallet: string;
}

const CONFIGS: Record<number, Omit<NetworkConfig, "contractAddress">> = {
  71: {
    isTestnet: true,
    chainId: 71,
    chainName: "Conflux eSpace Testnet",
    explorerUrl: "https://evmtestnet.confluxscan.net",
    paymentToken: process.env.NEXT_PUBLIC_USDT0_ADDRESS || "",
    serviceWallet: process.env.NEXT_PUBLIC_SERVICE_WALLET_ADDRESS || "",
  },
  1030: {
    isTestnet: false,
    chainId: 1030,
    chainName: "Conflux eSpace",
    explorerUrl: "https://evm.confluxscan.io",
    paymentToken: "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff",
    serviceWallet: process.env.NEXT_PUBLIC_SERVICE_WALLET_ADDRESS || "",
  },
};

const defaultChainId = process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? 1030 : 71;

const NetworkContext = createContext<NetworkConfig>({
  ...CONFIGS[defaultChainId],
  contractAddress: getContractAddress(defaultChainId),
});

export function useNetwork(): NetworkConfig {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const walletChainId = useChainId();
  const chainId = CONFIGS[walletChainId] ? walletChainId : defaultChainId;
  const config = CONFIGS[chainId];
  const contractAddress = getContractAddress(chainId);

  return (
    <NetworkContext.Provider value={{ ...config, contractAddress }}>
      {children}
    </NetworkContext.Provider>
  );
}
