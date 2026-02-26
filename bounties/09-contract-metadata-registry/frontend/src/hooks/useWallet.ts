'use client';

import type { Connector } from 'wagmi';
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from 'wagmi';
import { supportedChainId } from '../lib/config';

export interface UseWalletReturn {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  chainId: number | undefined;
  isCorrectChain: boolean;
  connectors: readonly Connector[];
  connect: (connector: Connector) => Promise<void>;
  disconnect: () => void;
  switchChain: () => Promise<void>;
  isConnecting: boolean;
  isSwitchingChain: boolean;
  error: string | null;
}

export function useWallet(): UseWalletReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    connectors,
    connectAsync,
    isPending: isConnecting,
    error: connectError,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain();

  const isCorrectChain = chainId === supportedChainId;
  const errorMessage: string | null =
    connectError?.message ?? null;

  const connect = async (connector: Connector) => {
    await connectAsync({ connector });
  };

  const switchChain = async () => {
    await switchChainAsync({ chainId: supportedChainId });
  };

  return {
    address,
    isConnected: isConnected && !!address,
    chainId,
    isCorrectChain,
    connectors,
    connect,
    disconnect,
    switchChain,
    isConnecting,
    isSwitchingChain,
    error: errorMessage,
  };
}
