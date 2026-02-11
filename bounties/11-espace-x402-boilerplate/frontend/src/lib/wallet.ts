/**
 * Multi-wallet connection — MetaMask, Fluent, OKX
 * Supports EIP-6963 multi-provider detection.
 */

import { ethers } from 'ethers';
import type { Network } from './networks';

declare global {
  interface Window {
    ethereum?: any;
    conflux?: any;
    okxwallet?: any;
  }
}

export type WalletType = 'metamask' | 'fluent' | 'okx';

export interface WalletOption {
  type: WalletType;
  name: string;
  icon: string;
  description: string;
  installed: boolean;
  downloadUrl: string;
}

function isMetaMaskInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.ethereum?.providers?.length) {
    return window.ethereum.providers.some(
      (p: any) => p.isMetaMask && !p.isConflux && !p.isOkxWallet,
    );
  }
  return !!window.ethereum?.isMetaMask;
}

function isFluentInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.conflux) return true;
  if (window.ethereum?.isConflux) return true;
  if (window.ethereum?.providers?.some((p: any) => p.isConflux)) return true;
  return false;
}

function isOKXInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.okxwallet) return true;
  if (window.ethereum?.isOkxWallet) return true;
  if (window.ethereum?.providers?.some((p: any) => p.isOkxWallet)) return true;
  return false;
}

export function getWalletOptions(): WalletOption[] {
  return [
    {
      type: 'metamask',
      name: 'MetaMask',
      icon: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
      description: 'Popular browser extension',
      installed: isMetaMaskInstalled(),
      downloadUrl: 'https://metamask.io/download/',
    },
    {
      type: 'fluent',
      name: 'Fluent Wallet',
      icon: 'https://app.swappi.io/static/media/fluent.25536d72.svg',
      description: 'Official Conflux wallet',
      installed: isFluentInstalled(),
      downloadUrl: 'https://fluentwallet.com/',
    },
    {
      type: 'okx',
      name: 'OKX Wallet',
      icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAP1BMVEWa7SwAAACb7yyc8C2h+C4ZJwee8y2P3Cl/wySDySWR3yoYJQem/y8WIgaN2CiT4ioJDgMeLgmX6Cs3VRCI0SdP60sXAAAAlUlEQVQ4jdWSyxKDIAxFNRAQwUpp//9byyUujI9x0WmnPavAPSOG0HV/BIF1TRvhBmbJR19rb9axGXqQLRau1f1IeyFeCfy20I6gQyG0vXtylSTCrLo0FhSJUltsLwIf9yK4ffQN4eAndR4yM0+P4iuFI3PMqs3loiaLOX90FpfC+YOhEsCTpCUw6FmQActeq9WT/HVejigFsTJBQS8AAAAASUVORK5CYII=',
      description: 'Multi-chain wallet by OKX',
      installed: isOKXInstalled(),
      downloadUrl: 'https://www.okx.com/web3',
    },
  ];
}

function getProvider(walletType: WalletType): any {
  switch (walletType) {
    case 'metamask': {
      if (window.ethereum?.providers?.length) {
        const mm = window.ethereum.providers.find(
          (p: any) => p.isMetaMask && !p.isConflux && !p.isOkxWallet,
        );
        if (mm) return mm;
      }
      if (window.ethereum?.isMetaMask) return window.ethereum;
      throw new Error('MetaMask not detected. Please install MetaMask.');
    }
    case 'fluent': {
      if (window.ethereum?.providers?.length) {
        const fl = window.ethereum.providers.find((p: any) => p.isConflux);
        if (fl) return fl;
      }
      if (window.ethereum?.isConflux) return window.ethereum;
      if (window.conflux) return window.conflux;
      throw new Error('Fluent Wallet not detected. Please install Fluent.');
    }
    case 'okx': {
      if (window.okxwallet) return window.okxwallet;
      if (window.ethereum?.providers?.length) {
        const okx = window.ethereum.providers.find((p: any) => p.isOkxWallet);
        if (okx) return okx;
      }
      if (window.ethereum?.isOkxWallet) return window.ethereum;
      throw new Error('OKX Wallet not detected. Please install OKX Wallet.');
    }
    default:
      throw new Error(`Unsupported wallet: ${walletType}`);
  }
}

export async function connectWallet(
  walletType: WalletType,
  network: Network,
): Promise<ethers.BrowserProvider> {
  const rawProvider = getProvider(walletType);
  const provider = new ethers.BrowserProvider(rawProvider);

  await provider.send('eth_requestAccounts', []);

  // Ensure correct chain
  const chainIdHex = `0x${network.chainId.toString(16)}`;
  try {
    await provider.send('wallet_switchEthereumChain', [
      { chainId: chainIdHex },
    ]);
  } catch (err: any) {
    if (err.code === 4902) {
      await provider.send('wallet_addEthereumChain', [
        {
          chainId: chainIdHex,
          chainName: network.name,
          nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
          rpcUrls: [network.rpcUrl],
          blockExplorerUrls: [network.explorerUrl],
        },
      ]);
    } else {
      throw err;
    }
  }

  return provider;
}

export async function getAddress(
  provider: ethers.BrowserProvider,
): Promise<string> {
  const signer = await provider.getSigner();
  return signer.getAddress();
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
