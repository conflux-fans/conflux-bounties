// src/hooks/useUserAuth.ts
"use client";

import { useAccount } from "wagmi";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface User {
  id: string;
  address: string;
  name?: string;
  email?: string;
  createdAt: Date;
  isNewUser: boolean;
}

// Hook to handle user authentication and first-time setup
export function useUserAuth() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  // Query to get or create user
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user", address],
    queryFn: async (): Promise<User | null> => {
      if (!address) return null;

      const response = await fetch(`/api/auth/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) {
        throw new Error("Failed to get user data");
      }

      return response.json();
    },
    enabled: !!address && isConnected,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation to update user profile
  const updateProfile = useMutation({
    mutationFn: async (profileData: { name?: string; email?: string }) => {
      const response = await fetch(`/api/auth/user`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, ...profileData }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      return response.json();
    },
    onSuccess: () => {
      // Refresh user data after update
      queryClient.invalidateQueries({ queryKey: ["user", address] });
    },
  });

  return {
    user,
    isLoading,
    error,
    updateProfile: updateProfile.mutate,
    isUpdating: updateProfile.isPending,
    isNewUser: user?.isNewUser ?? false,
  };
}

// src/app/layout.tsx (updated)

// Usage example in components:
