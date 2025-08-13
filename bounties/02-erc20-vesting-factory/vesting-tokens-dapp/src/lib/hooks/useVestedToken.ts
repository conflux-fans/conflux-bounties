// src/hooks/useVestedToken.ts
import { VESTED_TOKEN_ABI } from "@/lib/web3/config";
import { useReadContract } from "wagmi";

// Hook for getting token info
export function useTokenInfo(tokenAddress?: string) {
  const { data: name } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: VESTED_TOKEN_ABI,
    functionName: "name",
    query: {
      enabled: !!tokenAddress,
    },
  });

  const { data: symbol } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: VESTED_TOKEN_ABI,
    functionName: "symbol",
    query: {
      enabled: !!tokenAddress,
    },
  });

  const { data: decimals } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: VESTED_TOKEN_ABI,
    functionName: "decimals",
    query: {
      enabled: !!tokenAddress,
    },
  });

  const { data: totalSupply } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: VESTED_TOKEN_ABI,
    functionName: "totalSupply",
    query: {
      enabled: !!tokenAddress,
    },
  });

  return {
    name,
    symbol,
    decimals,
    totalSupply,
  };
}

// Hook for getting token balance
export function useTokenBalance(
  tokenAddress?: string,
  accountAddress?: string
) {
  return useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: VESTED_TOKEN_ABI,
    functionName: "balanceOf",
    args: accountAddress ? [accountAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!(tokenAddress && accountAddress),
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}
