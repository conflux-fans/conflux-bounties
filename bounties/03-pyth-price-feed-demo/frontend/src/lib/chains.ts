import { Chain } from 'viem';

export const ConfluxESpace: Chain = {
  id: 1030,
  name: 'Conflux eSpace',
  nativeCurrency: {
    decimals: 18,
    name: 'CFX',
    symbol: 'CFX',
  },
  rpcUrls: {
    default: { http: ['https://evm.confluxrpc.com'] },
    public: { http: ['https://evm.confluxrpc.com'] },
  },
  blockExplorers: {
    default: { name: 'ConfluxScan', url: 'https://evm.confluxscan.net/' },
  },
  testnet: false,
};

export const supportedChains = [ConfluxESpace];

export function getChainById(chainId: number): Chain | undefined {
  return supportedChains.find(chain => chain.id === chainId);
}

export function isChainSupported(chainId: number): boolean {
  return supportedChains.some(chain => chain.id === chainId);
}