'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type State, WagmiProvider } from 'wagmi';
import { getConfig } from '../lib/config';

type Props = {
  children: ReactNode;
  initialState?: State;
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function Providers({ children, initialState }: Props) {
  const [config] = useState(getConfig);
  const [queryClient] = useState(createQueryClient);

  return (
    <WagmiProvider config={config} initialState={initialState} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
