import { createPublicClient, createWalletClient, http, custom } from 'viem';
import { ConfluxESpace } from './chains';

export const publicClient = createPublicClient({
  chain: ConfluxESpace,
  transport: http('https://evm.confluxrpc.com'),
});

export const getWalletClient = () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    return createWalletClient({
      chain: ConfluxESpace,
      transport: custom(window.ethereum),
    });
  }
  return null;
};