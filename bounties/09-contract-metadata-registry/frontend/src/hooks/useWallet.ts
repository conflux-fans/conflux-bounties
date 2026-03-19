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
  resetError: () => void;
  isConnecting: boolean;
  isSwitchingChain: boolean;
  error: string | null;
}

function friendlyError(err: Error | null | undefined): string | null {
  if (!err) return null;
  const msg = err.message ?? '';

  if (msg.includes('User rejected') || msg.includes('user rejected') || msg.includes('User denied') || msg.includes('user denied'))
    return 'Request rejected. Try again when ready.';
  if (msg.includes('Already processing') || msg.includes('already pending'))
    return 'A wallet request is already pending — check your wallet.';
  if (msg.includes('Chain not configured') || msg.includes('chain is not configured'))
    return 'This network is not supported.';
  if (msg.includes('Connector not found') || msg.includes('connector not found'))
    return 'No wallet detected. Install MetaMask or Fluent.';
  if (msg.includes('Request reset') || msg.includes('request reset'))
    return null;
  // Truncate long provider errors
  if (msg.length > 120) return msg.slice(0, 100) + '…';
  return msg;
}

export function useWallet(): UseWalletReturn {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const {
    connectors,
    connectAsync,
    isPending: isConnecting,
    error: connectError,
    reset: resetConnect,
  } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    switchChainAsync,
    isPending: isSwitchingChain,
    error: switchError,
    reset: resetSwitch,
  } = useSwitchChain();

  const isCorrectChain = chainId === supportedChainId;
  const errorMessage: string | null =
    friendlyError(connectError) ?? friendlyError(switchError);

  const connect = async (connector: Connector) => {
    resetConnect();
    await connectAsync({ connector });
  };

  const switchChain = async () => {
    resetSwitch();
    await switchChainAsync({ chainId: supportedChainId });
  };

  const resetError = () => {
    resetConnect();
    resetSwitch();
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
    resetError,
    isConnecting,
    isSwitchingChain,
    error: errorMessage,
  };
}
