import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { confluxESpace, confluxESpaceTestnet } from "wagmi/chains";

export const chains = [confluxESpace, confluxESpaceTestnet] as const;

export const config = getDefaultConfig({
  appName: "Conflux Contract Metadata Registry",
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "demo",
  chains: [confluxESpaceTestnet, confluxESpace],
  ssr: true,
});

export const REGISTRY_ADDRESS: Record<number, `0x${string}`> = {
  [confluxESpace.id]:
    (process.env.NEXT_PUBLIC_ESPACE_REGISTRY_ADDRESS as `0x${string}`) ||
    "0x0000000000000000000000000000000000000000",
  [confluxESpaceTestnet.id]:
    (process.env.NEXT_PUBLIC_ESPACE_TESTNET_REGISTRY_ADDRESS as `0x${string}`) ||
    "0x0000000000000000000000000000000000000000",
};
