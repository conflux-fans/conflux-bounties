import { parseEther, type Address } from 'viem';

/**
 * Utility functions for formatting and parsing values
 */

// Format an object to JSON with bigint handling
export function formatJson(obj: unknown): string {
  return JSON.stringify(
    obj,
    (_, value) => (typeof value === 'bigint' ? value.toString() : value),
    2
  );
}

// Validate an EVM address (0x followed by 40 hex characters)
export function validateAddress(address: string): Address {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return address as Address;
  }
  throw new Error(`Invalid address: ${address}`);
}

// Keep existing utils namespace for current imports
export const utils = {
  // Convert ether to wei
  parseEther,
  formatJson,
  validateAddress,
};

// Also export viem's parseEther directly
export { parseEther };
