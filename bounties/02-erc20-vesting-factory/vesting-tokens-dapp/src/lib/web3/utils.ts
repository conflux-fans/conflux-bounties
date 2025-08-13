// Native utilities - no viem dependency!
import {
  formatEther,
  parseEther,
  getAddress,
  shortenAddress,
} from "./native-utils";

export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18
): string {
  return formatEther(amount);
}

export function parseTokenAmount(amount: string): bigint {
  return parseEther(amount);
}

export { shortenAddress, getAddress };

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export function calculateVestingProgress(
  startTime: number,
  cliff: number,
  duration: number,
  currentTime: number = Date.now() / 1000
): {
  progressPercentage: number;
  timeElapsed: number;
  timeRemaining: number;
  isCliffPeriod: boolean;
  isVestingComplete: boolean;
} {
  const cliffEndTime = startTime + cliff;
  const vestingEndTime = startTime + duration;

  const timeElapsed = Math.max(0, currentTime - startTime);
  const timeRemaining = Math.max(0, vestingEndTime - currentTime);

  const isCliffPeriod = currentTime < cliffEndTime;
  const isVestingComplete = currentTime >= vestingEndTime;

  let progressPercentage = 0;
  if (currentTime >= cliffEndTime) {
    if (currentTime >= vestingEndTime) {
      progressPercentage = 100;
    } else {
      const vestingTimeElapsed = currentTime - cliffEndTime;
      const totalVestingDuration = duration - cliff;
      progressPercentage = (vestingTimeElapsed / totalVestingDuration) * 100;
    }
  }

  return {
    progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
    timeElapsed,
    timeRemaining,
    isCliffPeriod,
    isVestingComplete,
  };
}

export function getContractErrorMessage(error: any): string {
  if (error?.message?.includes("user rejected")) {
    return "Transaction was rejected by user";
  }
  if (error?.message?.includes("insufficient funds")) {
    return "Insufficient funds for transaction";
  }
  if (error?.message?.includes("execution reverted")) {
    return "Transaction failed: Contract execution reverted";
  }
  return error?.message || "An unknown error occurred";
}
