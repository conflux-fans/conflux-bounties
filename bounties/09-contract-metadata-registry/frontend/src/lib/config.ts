import {
  createConfig,
  createStorage,
  cookieStorage,
  http,
  injected,
} from 'wagmi';
import { confluxESpaceTestnet } from 'wagmi/chains';

/** Conflux eSpace Testnet */
export const supportedChain = confluxESpaceTestnet;
export const supportedChainId = confluxESpaceTestnet.id;

export function getConfig() {
  return createConfig({
    chains: [confluxESpaceTestnet],
    connectors: [injected({ unstable_shimAsyncInject: 3_000 })],
    multiInjectedProviderDiscovery: true,
    ssr: true,
    storage: createStorage({
      storage: cookieStorage,
    }),
    transports: {
      [confluxESpaceTestnet.id]: http(),
    },
  });
}
