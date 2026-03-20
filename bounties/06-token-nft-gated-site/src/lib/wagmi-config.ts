"use client";

import { createConfig, http, injected } from "wagmi";
import { confluxESpace, confluxESpaceTestnet } from "@/lib/chains";

export const wagmiConfig = createConfig({
  chains: [confluxESpace, confluxESpaceTestnet],
  connectors: [injected()],
  transports: {
    [confluxESpace.id]: http(),
    [confluxESpaceTestnet.id]: http(),
  },
  ssr: true,
});
