import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from "viem";
import { getChainById } from "@/lib/chains";
import type { RulesJson, TokenCondition } from "@/lib/gating/types";

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const erc721Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const erc1155Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const clientCache = new Map<number, PublicClient>();

function getClient(chainId: number): PublicClient | null {
  const chain = getChainById(chainId);
  if (!chain) return null;
  let c = clientCache.get(chainId);
  if (!c) {
    c = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });
    clientCache.set(chainId, c);
  }
  return c;
}

type CacheEntry = { result: boolean; at: number };
const evalCache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

function cacheKey(wallet: string, c: TokenCondition): string {
  return `${wallet}:${JSON.stringify(c)}`;
}

export async function evaluateCondition(
  wallet: Address,
  condition: TokenCondition,
): Promise<boolean> {
  const key = cacheKey(wallet.toLowerCase(), condition);
  const now = Date.now();
  const hit = evalCache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.result;

  const client = getClient(condition.chainId);
  if (!client) {
    evalCache.set(key, { result: false, at: now });
    return false;
  }

  let ok = false;
  try {
    if (condition.type === "ERC20") {
      const bal = await client.readContract({
        address: condition.address as Address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
      });
      ok = bal >= BigInt(condition.minBalance);
    } else if (condition.type === "ERC721") {
      const owner = await client.readContract({
        address: condition.address as Address,
        abi: erc721Abi,
        functionName: "ownerOf",
        args: [BigInt(condition.tokenId)],
      });
      ok = owner.toLowerCase() === wallet.toLowerCase();
    } else {
      const bal = await client.readContract({
        address: condition.address as Address,
        abi: erc1155Abi,
        functionName: "balanceOf",
        args: [wallet, BigInt(condition.tokenId)],
      });
      ok = bal >= BigInt(condition.minQuantity);
    }
  } catch {
    ok = false;
  }

  evalCache.set(key, { result: ok, at: now });
  return ok;
}

export async function evaluateRulesJson(
  wallet: Address,
  rules: RulesJson,
  combineLogic: "ALL" | "ANY",
): Promise<boolean> {
  const results = await Promise.all(
    rules.conditions.map((c) => evaluateCondition(wallet, c)),
  );
  if (combineLogic === "ANY") return results.some(Boolean);
  return results.every(Boolean);
}
