/**
 * Shared network/token config for the frontend.
 * Mirrors seller/src/config/networks.ts.
 */

export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  paymentMethod: 'native' | 'eip3009' | 'erc20';
}

export interface Network {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  tokens: Token[];
}

export const NETWORKS: Record<string, Network> = {
  testnet: {
    name: 'Conflux eSpace Testnet',
    chainId: 71,
    rpcUrl: 'https://evmtestnet.confluxrpc.com',
    explorerUrl: 'https://evmtestnet.confluxscan.org',
    tokens: [
      { symbol: 'CFX', name: 'Conflux', address: '0x0000000000000000000000000000000000000000', decimals: 18, paymentMethod: 'native' },
      { symbol: 'USDT', name: 'Faucet USDT', address: '0x7d682e65EFC5C13Bf4E394B8f376C48e6baE0355', decimals: 18, paymentMethod: 'erc20' },
      { symbol: 'USDC', name: 'USDC', address: '0x349298b0e20df67defd6efb8f3170cf4a32722ef', decimals: 18, paymentMethod: 'erc20' },
      { symbol: 'BTC', name: 'Faucet BTC', address: '0x54593e02c39aeff52b166bd036797d2b1478de8d', decimals: 18, paymentMethod: 'erc20' },
      { symbol: 'ETH', name: 'Faucet ETH', address: '0xcd71270f82f319e0498ff98af8269c3f0d547c65', decimals: 18, paymentMethod: 'erc20' },
    ],
  },
  mainnet: {
    name: 'Conflux eSpace',
    chainId: 1030,
    rpcUrl: 'https://evm.confluxrpc.com',
    explorerUrl: 'https://evm.confluxscan.io',
    tokens: [
      { symbol: 'CFX', name: 'Conflux', address: '0x0000000000000000000000000000000000000000', decimals: 18, paymentMethod: 'native' },
      { symbol: 'USDT0', name: 'USDT0', address: '0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff', decimals: 6, paymentMethod: 'eip3009' },
      { symbol: 'USDT', name: 'Tether USD', address: '0xfe97e85d13abd9c1c33384e796f10b73905637ce', decimals: 18, paymentMethod: 'erc20' },
      { symbol: 'USDC', name: 'USD Coin', address: '0x6963efed0ab40f6c3d7bda44a05dcf1437c44372', decimals: 18, paymentMethod: 'erc20' },
      { symbol: 'AxCNH', name: 'AxCNH', address: '0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e', decimals: 6, paymentMethod: 'erc20' },
    ],
  },
};
