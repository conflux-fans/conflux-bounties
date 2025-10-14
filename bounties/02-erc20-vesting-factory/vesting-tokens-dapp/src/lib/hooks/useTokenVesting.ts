// src/hooks/useTokenVesting.ts (FIXED)
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import { useEffect, useState } from "react";
import { TOKEN_VESTING_ABI } from "@/lib/web3/config"; // Fixed import

// Hook for claiming vested tokens
export function useClaimVestedTokens(vestingContractAddress?: string) {
  const [isPending, setIsPending] = useState(false);
  const [lastClaimedAmount, setLastClaimedAmount] = useState<string | null>(
    null
  );
  const { address } = useAccount();

  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: waitError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Get releasable amount before claiming
  const { data: releasableAmount } = useReleasableAmount(
    vestingContractAddress
  );

  // Reset pending state when transaction completes (success or failure)
  useEffect(() => {
    if (isSuccess || writeError || waitError) {
      setIsPending(false);
    }
  }, [isSuccess, writeError, waitError]);

  // Database sync after successful transaction
  useEffect(() => {
    const syncToDatabase = async () => {
      if (isSuccess && hash && vestingContractAddress && address) {
        try {
          console.log("Syncing claim to database...");

          const response = await fetch("/api/claim/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vestingContractAddress,
              beneficiaryAddress: address,
              amountClaimed:
                lastClaimedAmount || releasableAmount?.toString() || "0",
              transactionHash: hash,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to sync claim to database:", errorData);
          } else {
            const result = await response.json();
            console.log("Successfully synced claim to database:", result);
          }
        } catch (error) {
          console.error("Error syncing claim to database:", error);
        } finally {
          setLastClaimedAmount(null);
        }
      }
    };

    syncToDatabase();
  }, [
    isSuccess,
    hash,
    vestingContractAddress,
    address,
    lastClaimedAmount,
    releasableAmount,
  ]);

  const claimTokens = async () => {
    if (!vestingContractAddress) {
      throw new Error("No vesting contract address provided");
    }

    try {
      setIsPending(true);

      // Store the amount we're about to claim for database sync
      if (releasableAmount) {
        setLastClaimedAmount(releasableAmount.toString());
      }

      await writeContract({
        address: vestingContractAddress as `0x${string}`,
        abi: TOKEN_VESTING_ABI,
        functionName: "release",
      });
    } catch (err) {
      console.error("Claim error:", err);
      setIsPending(false);
      setLastClaimedAmount(null);
      throw err;
    }
  };

  // Combine all error states
  const error = writeError || waitError;

  return {
    claimTokens,
    data: hash,
    error,
    isLoading: isPending || isWritePending || isConfirming,
    isSuccess,
    reset: () => {
      setIsPending(false);
      setLastClaimedAmount(null);
      resetWrite();
    },
  };
}

// Hook for getting vesting info
export function useVestingInfo(vestingContractAddress?: string) {
  return useReadContract({
    address: vestingContractAddress as `0x${string}`,
    abi: TOKEN_VESTING_ABI,
    functionName: "getVestingInfo",
    query: {
      enabled: !!vestingContractAddress,
    },
  });
}

// Hook for getting releasable amount
export function useReleasableAmount(vestingContractAddress?: string) {
  return useReadContract({
    address: vestingContractAddress as `0x${string}`,
    abi: TOKEN_VESTING_ABI,
    functionName: "releasableAmount",
    query: {
      enabled: !!vestingContractAddress,
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });
}
