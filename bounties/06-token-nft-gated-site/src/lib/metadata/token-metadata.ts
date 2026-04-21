import { createPublicClient, http, type Address } from "viem";
import { getChainById } from "@/lib/chains";
import { prisma } from "@/lib/prisma";

const erc20MetaAbi = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
] as const;

export async function fetchAndCacheTokenMetadata(params: {
  chainId: number;
  tokenAddress: Address;
  standard: "ERC20" | "ERC721" | "ERC1155";
}): Promise<{ name: string | null; symbol: string | null; uri: string | null }> {
  const chain = getChainById(params.chainId);
  if (!chain) {
    throw new Error("Unsupported chainId");
  }

  const client = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0]),
  });

  let name: string | null = null;
  let symbol: string | null = null;
  let uri: string | null = null;

  try {
    if (params.standard === "ERC1155") {
      const u = await client.readContract({
        address: params.tokenAddress,
        abi: [
          {
            name: "uri",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "id", type: "uint256" }],
            outputs: [{ type: "string" }],
          },
        ] as const,
        functionName: "uri",
        args: [BigInt(0)],
      });
      uri = u;
    } else {
      name = await client.readContract({
        address: params.tokenAddress,
        abi: erc20MetaAbi,
        functionName: "name",
      });
      symbol = await client.readContract({
        address: params.tokenAddress,
        abi: erc20MetaAbi,
        functionName: "symbol",
      });
    }
  } catch {
    /* contract may not implement */
  }

  await prisma.tokenMetadataCache.upsert({
    where: {
      chainId_tokenAddress_standard: {
        chainId: params.chainId,
        tokenAddress: params.tokenAddress.toLowerCase(),
        standard: params.standard,
      },
    },
    create: {
      chainId: params.chainId,
      tokenAddress: params.tokenAddress.toLowerCase(),
      standard: params.standard,
      name,
      symbol,
      uri,
    },
    update: { name, symbol, uri },
  });

  return { name, symbol, uri };
}
