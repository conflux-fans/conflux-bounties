/**
 * Network and token configuration for Conflux eSpace
 *
 * Supports testnet (chain 71) and mainnet (chain 1030).
 * Each token specifies its payment method:
 *   - native:  Direct CFX transfer
 *   - eip3009: Gasless transferWithAuthorization (USDT0 only)
 *   - erc20:   Standard approve + transferFrom
 */

export interface TokenConfig {
  symbol: string;
  name: string;
  address: string; // '0x0' for native CFX
  decimals: number;
  paymentMethod: 'native' | 'eip3009' | 'erc20';
  eip712Name?: string;  // For EIP-3009 tokens
  eip712Version?: string;
  pricePerQuery: string; // Amount in smallest unit
}

export interface NetworkConfig {
  name: string;
  chainId: number;
  caip2: string; // e.g. "eip155:1030"
  rpcUrl: string;
  explorerUrl: string;
  tokens: Record<string, TokenConfig>;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  testnet: {
    name: 'Conflux eSpace Testnet',
    chainId: 71,
    caip2: 'eip155:71',
    rpcUrl: 'https://evmtestnet.confluxrpc.com',
    explorerUrl: 'https://evmtestnet.confluxscan.org',
    tokens: {
      CFX: {
        symbol: 'CFX',
        name: 'Conflux',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        paymentMethod: 'native',
        pricePerQuery: '1000000000000000', // 0.001 CFX
      },
      USDT: {
        symbol: 'USDT',
        name: 'Faucet USDT',
        address: '0x7d682e65EFC5C13Bf4E394B8f376C48e6baE0355',
        decimals: 18,
        paymentMethod: 'erc20',
        pricePerQuery: '100000000000000', // 0.0001 USDT
      },
      USDC: {
        symbol: 'USDC',
        name: 'USDC',
        address: '0x349298b0e20df67defd6efb8f3170cf4a32722ef',
        decimals: 18,
        paymentMethod: 'erc20',
        pricePerQuery: '100000000000000', // 0.0001 USDC
      },
      BTC: {
        symbol: 'BTC',
        name: 'Faucet BTC',
        address: '0x54593e02c39aeff52b166bd036797d2b1478de8d',
        decimals: 18,
        paymentMethod: 'erc20',
        pricePerQuery: '1000000000000', // 0.000001 BTC
      },
      ETH: {
        symbol: 'ETH',
        name: 'Faucet ETH',
        address: '0xcd71270f82f319e0498ff98af8269c3f0d547c65',
        decimals: 18,
        paymentMethod: 'erc20',
        pricePerQuery: '10000000000000', // 0.00001 ETH
      },
    },
  },
  mainnet: {
    name: 'Conflux eSpace',
    chainId: 1030,
    caip2: 'eip155:1030',
    rpcUrl: 'https://evm.confluxrpc.com',
    explorerUrl: 'https://evm.confluxscan.io',
    tokens: {
      CFX: {
        symbol: 'CFX',
        name: 'Conflux',
        address: '0x0000000000000000000000000000000000000000',
        decimals: 18,
        paymentMethod: 'native',
        pricePerQuery: '1000000000000000', // 0.001 CFX
      },
      USDT0: {
        symbol: 'USDT0',
        name: 'USDT0',
        address: '0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff',
        decimals: 6,
        paymentMethod: 'eip3009',
        eip712Name: 'USDT0',
        eip712Version: '1',
        pricePerQuery: '100', // 0.0001 USDT0
      },
      USDT: {
        symbol: 'USDT',
        name: 'Tether USD',
        address: '0xfe97e85d13abd9c1c33384e796f10b73905637ce',
        decimals: 18,
        paymentMethod: 'erc20',
        pricePerQuery: '100000000000000', // 0.0001 USDT
      },
      USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        address: '0x6963efed0ab40f6c3d7bda44a05dcf1437c44372',
        decimals: 18,
        paymentMethod: 'erc20',
        pricePerQuery: '100000000000000', // 0.0001 USDC
      },
      AxCNH: {
        symbol: 'AxCNH',
        name: 'AxCNH',
        address: '0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e',
        decimals: 6,
        paymentMethod: 'erc20',
        pricePerQuery: '100', // 0.0001 AxCNH
      },
    },
  },
};

export function getNetwork(name: string): NetworkConfig {
  const network = NETWORKS[name];
  if (!network) throw new Error(`Unknown network: ${name}`);
  return network;
}

export function getToken(networkName: string, symbol: string): TokenConfig {
  const network = getNetwork(networkName);
  const token = network.tokens[symbol];
  if (!token) throw new Error(`Token ${symbol} not found on ${networkName}`);
  return token;
}
