// app/src/lib/hooks/useTokenFunding.ts (UPDATED COMMENTS)
import { useState } from "react";
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { formatEther } from "viem";
import { ERC20_ABI, TOKEN_VESTING_ABI } from "@/lib/web3/config";

// Hook to check if vesting contract has sufficient tokens
export function useVestingContractBalance(
  tokenAddress?: string,
  vestingContractAddress?: string
) {
  const { data: balance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [vestingContractAddress],
    query: {
      enabled: !!(tokenAddress && vestingContractAddress),
      refetchInterval: 10000,
    },
  });

  const { data: totalAmount } = useReadContract({
    address: vestingContractAddress as `0x${string}`,
    abi: TOKEN_VESTING_ABI,
    functionName: "totalAmount",
    query: {
      enabled: !!vestingContractAddress,
    },
  });

  const hassufficientBalance =
    balance && totalAmount ? (balance as bigint) >= totalAmount : false;
  const shortfall =
    balance && totalAmount && (balance as bigint) < totalAmount
      ? totalAmount - (balance as bigint)
      : 0n;

  return {
    balance, // Wei amount
    totalAmount, // Wei amount
    hassufficientBalance,
    shortfall, // Wei amount
    isLoading: !balance && !totalAmount,
    // ✅ TOKEN CONVERSION HELPERS FOR DISPLAY
    balanceTokens: balance ? parseFloat(formatEther(balance as bigint)) : 0,
    totalAmountTokens: totalAmount ? parseFloat(formatEther(totalAmount)) : 0,
    shortfallTokens: shortfall ? parseFloat(formatEther(shortfall)) : 0,
  };
}

// Hook to send tokens to vesting contract
export function useSendTokensToVesting() {
  const [isPending, setIsPending] = useState(false);

  const {
    writeContract,
    data: hash,
    error,
    isPending: isWritePending,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // ✅ ACCEPTS WEI AMOUNT FOR BLOCKCHAIN TRANSACTION
  const sendTokens = async (
    tokenAddress: string,
    vestingContractAddress: string,
    amountInWei: bigint // Must be in Wei
  ) => {
    try {
      setIsPending(true);

      await writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [vestingContractAddress, amountInWei],
      });
    } catch (err) {
      console.error("Send tokens error:", err);
      setIsPending(false);
      throw err;
    }
  };

  return {
    sendTokens,
    data: hash,
    error,
    isLoading: isPending || isWritePending || isConfirming,
    isSuccess,
  };
}

// Hook to get user's token balance
export function useUserTokenBalance(
  tokenAddress?: string,
  userAddress?: string
) {
  const { data: balance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [userAddress],
    query: {
      enabled: !!(tokenAddress && userAddress),
      refetchInterval: 30000,
    },
  });

  return {
    data: balance, // Wei amount
    // ✅ TOKEN CONVERSION HELPER FOR DISPLAY
    balanceTokens: balance ? parseFloat(formatEther(balance as bigint)) : 0,
  };
}
