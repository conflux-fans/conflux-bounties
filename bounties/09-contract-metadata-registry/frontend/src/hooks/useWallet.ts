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

function friendlyError(err: Error | null | undefined): string | null {
  if (!err) return null;
  const msg = err.message ?? '';

  if (msg.includes('User rejected') || msg.includes('user rejected'))
    return 'Connection request was rejected. Please try again.';
  if (msg.includes('Already processing'))
    return 'A wallet request is already pending — check your wallet extension.';
  if (msg.includes('Chain not configured') || msg.includes('chain is not configured'))
    return 'This network is not supported. Please switch to Conflux eSpace Testnet.';
  if (msg.includes('Connector not found') || msg.includes('connector not found'))
    return 'No wallet detected. Install MetaMask or Fluent, then refresh.';
  if (msg.length > 200) return msg.slice(0, 180) + '…';
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
  } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    switchChainAsync,
    isPending: isSwitchingChain,
    error: switchError,
  } = useSwitchChain();

  const isCorrectChain = chainId === supportedChainId;
  const errorMessage: string | null =
    friendlyError(connectError) ?? friendlyError(switchError);

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
