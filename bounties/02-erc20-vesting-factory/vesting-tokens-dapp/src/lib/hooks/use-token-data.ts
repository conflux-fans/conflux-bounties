// src/lib/hooks/use-token-data.ts
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

export function useTokenData(tokenAddress?: string) {
  return useQuery({
    queryKey: ["token", tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) throw new Error("No token address provided");

      const response = await fetch(`/api/tokens/${tokenAddress}`);
      if (!response.ok) {
        throw new Error("Failed to fetch token data");
      }
      return response.json();
    },
    enabled: !!tokenAddress,
  });
}

export function useUserData() {
  const { address } = useAccount();

  return useQuery({
    queryKey: ["user", address],
    queryFn: async () => {
      if (!address) throw new Error("No user address");

      // 🎯 USE THE AUTH/USER ROUTE HERE
      const response = await fetch("/api/auth/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }
      return response.json();
    },
    enabled: !!address,
  });
}

export function useTokenAnalytics(tokenAddress?: string) {
  return useQuery({
    queryKey: ["analytics", tokenAddress],
    queryFn: async () => {
      if (!tokenAddress) throw new Error("No token address provided");

      const response = await fetch(`/api/analytics/${tokenAddress}`);
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      return response.json();
    },
    enabled: !!tokenAddress,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
