import { formatEther, parseEther } from "viem";

/**
 * Convert Wei to token units (divide by 10^18)
 */
export function weiToTokens(weiAmount: string | bigint): number {
  if (!weiAmount) return 0;
  return parseFloat(formatEther(BigInt(weiAmount)));
}

/**
 * Convert token units to Wei (multiply by 10^18)
 */
export function tokensToWei(tokenAmount: number | string): bigint {
  if (!tokenAmount) return 0n;
  return parseEther(tokenAmount.toString());
}

/**
 * Format token amount for display with proper decimals
 */
export function formatTokenAmount(
  amount: string | bigint | number,
  decimals: number = 2,
  symbol?: string
): string {
  if (!amount) return "0";

  let tokenAmount: number;

  // If it's a large number (likely Wei), convert it
  if (typeof amount === "string" && amount.length > 10) {
    tokenAmount = weiToTokens(amount);
  } else if (typeof amount === "bigint") {
    tokenAmount = weiToTokens(amount);
  } else {
    tokenAmount = parseFloat(amount.toString());
  }

  const formatted = tokenAmount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return symbol ? `${formatted} ${symbol}` : formatted;
}

/**
 * Check if a value is in Wei format (very large number)
 */
export function isWeiFormat(value: string | number | bigint): boolean {
  // Use 1e17 as the threshold (0.1 ETH in Wei) - more reliable detection
  const threshold = 1e17;
  
  if (typeof value === "bigint") return value >= BigInt(threshold);
  if (typeof value === "string") {
    const num = parseFloat(value);
    return num >= threshold;
  }
  return value >= threshold;
}
