import { defineChain, type Chain } from "viem";

const mainRpc =
  process.env.CONFLUX_RPC_URL ?? "https://evm.confluxrpc.com";
const testRpc =
  process.env.CONFLUX_TESTNET_RPC_URL ?? "https://evmtestnet.confluxrpc.com";

export const confluxESpace = defineChain({
  id: 1030,
  name: "Conflux eSpace",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: {
    default: { http: [mainRpc] },
    public: { http: [mainRpc] },
  },
  blockExplorers: {
    default: { name: "Conflux Scan", url: "https://evm.confluxscan.io" },
  },
});

export const confluxESpaceTestnet = defineChain({
  id: 71,
  name: "Conflux eSpace Testnet",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: {
    default: { http: [testRpc] },
    public: { http: [testRpc] },
  },
  blockExplorers: {
    default: {
      name: "Conflux Testnet Scan",
      url: "https://evmtestnet.confluxscan.io",
    },
  },
});

export const appChains = [confluxESpace, confluxESpaceTestnet] as const;

export type AppChainId = (typeof appChains)[number]["id"];

export function getChainById(chainId: number): Chain | undefined {
  return appChains.find((c) => c.id === chainId);
}
