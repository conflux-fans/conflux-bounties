'use client';

import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Conflux eSpace Testnet
const confluxTestnet = {
  id: 71,
  name: 'Conflux eSpace Testnet',
  network: 'conflux-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Conflux',
    symbol: 'CFX',
  },
  rpcUrls: {
    public: { http: ['https://test.confluxrpc.com'] },
    default: { http: ['https://test.confluxrpc.com'] },
  },
  blockExplorers: {
    default: { name: 'Conflux Scan', url: 'https://testnet.confluxscan.net' },
  },
};

// Conflux eSpace Mainnet
const confluxMainnet = {
  id: 1030,
  name: 'Conflux eSpace',
  network: 'conflux',
  nativeCurrency: {
    decimals: 18,
    name: 'Conflux',
    symbol: 'CFX',
  },
  rpcUrls: {
    public: { http: ['https://main.confluxrpc.com'] },
    default: { http: ['https://main.confluxrpc.com'] },
  },
  blockExplorers: {
    default: { name: 'Conflux Scan', url: 'https://confluxscan.net' },
  },
};

const { chains, publicClient } = configureChains(
  [confluxTestnet, confluxMainnet],
  [publicProvider()]
);

const config = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({
      chains,
      options: {
        name: 'Injected',
        shimDisconnect: true,
      },
    }),
  ],
  publicClient,
});

const queryClient = new QueryClient();

export default function Providers({ children }) {
  return (
    <WagmiConfig config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiConfig>
  );
}
