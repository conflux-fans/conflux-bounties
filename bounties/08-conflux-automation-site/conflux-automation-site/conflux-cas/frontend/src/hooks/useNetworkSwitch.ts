'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';

export const IS_MAINNET = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
export const EXPECTED_CHAIN_ID = IS_MAINNET ? 1030 : 71;
export const EXPECTED_CHAIN_NAME = IS_MAINNET
  ? 'Conflux eSpace'
  : 'Conflux eSpace Testnet';

// Full EIP-3085 chain parameters for wallet_addEthereumChain fallback.
const CHAIN_PARAMS = IS_MAINNET
  ? {
      chainId: '0x406', // 1030
      chainName: 'Conflux eSpace',
      nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
      rpcUrls: ['https://evm.confluxrpc.com'],
      blockExplorerUrls: ['https://evm.confluxscan.org'],
    }
  : {
      chainId: '0x47', // 71
      chainName: 'Conflux eSpace Testnet',
      nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
      rpcUrls: ['https://evmtestnet.confluxrpc.com'],
      blockExplorerUrls: ['https://evmtestnet.confluxscan.org'],
    };

export function useNetworkSwitch() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const [switchError, setSwitchError] = useState<string | null>(null);

  const isWrongNetwork = isConnected && chainId !== EXPECTED_CHAIN_ID;

  useEffect(() => {
    if (!isWrongNetwork) setSwitchError(null);
  }, [isWrongNetwork]);

  const handleSwitchNetwork = useCallback(async () => {
    setSwitchError(null);
    try {
      switchChain({ chainId: EXPECTED_CHAIN_ID });
    } catch {
      // Fallback: manually add+switch via EIP-3085
      const provider = (
        window as Window & {
          ethereum?: { request: (a: unknown) => Promise<unknown> };
        }
      ).ethereum;
      if (!provider) {
        setSwitchError(
          'No wallet found — add the network manually in MetaMask.'
        );
        return;
      }
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [CHAIN_PARAMS],
        });
      } catch (addErr: unknown) {
        const msg = addErr instanceof Error ? addErr.message : String(addErr);
        if (!msg.toLowerCase().includes('user rejected')) {
          setSwitchError(`Could not switch: ${msg}`);
        }
      }
    }
  }, [switchChain]);

  return { isWrongNetwork, isSwitching, switchError, handleSwitchNetwork };
}
