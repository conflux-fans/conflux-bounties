import { ethers } from 'ethers';

/**
 * Address validation utilities for eSpace (0x format only)
 * This unifies address handling to use only Ethereum-compatible addresses
 */

export interface AddressValidationResult {
  isValid: boolean;
  normalized?: string;
  error?: string;
}

/**
 * Validates and normalizes an address to 0x format (eSpace only)
 * Rejects cfx: format addresses as we're focusing on eSpace scope
 */
export function validateAndNormalizeAddress(address: string): AddressValidationResult {
  if (!address || typeof address !== 'string') {
    return {
      isValid: false,
      error: 'Address is required and must be a string'
    };
  }

  const trimmedAddress = address.trim();

  // Reject cfx: format addresses (Core Space)
  if (trimmedAddress.startsWith('cfx:')) {
    return {
      isValid: false,
      error: 'Core Space (cfx:) addresses are not supported. Please use eSpace (0x) addresses only.'
    };
  }

  // Ensure it starts with 0x
  if (!trimmedAddress.startsWith('0x')) {
    return {
      isValid: false,
      error: 'Address must start with 0x (eSpace format)'
    };
  }

  // Validate using ethers.js
  try {
    const normalizedAddress = ethers.getAddress(trimmedAddress);
    return {
      isValid: true,
      normalized: normalizedAddress
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid Ethereum address format'
    };
  }
}

/**
 * Checks if an address is a valid Ethereum address (0x format)
 */
export function isValidEthereumAddress(address: string): boolean {
  return validateAndNormalizeAddress(address).isValid;
}

/**
 * Gets the checksum version of an address
 */
export function getChecksumAddress(address: string): string {
  const validation = validateAndNormalizeAddress(address);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid address');
  }
  return validation.normalized!;
}

/**
 * Converts an address to lowercase for database storage
 */
export function normalizeAddressForStorage(address: string): string {
  const validation = validateAndNormalizeAddress(address);
  if (!validation.isValid) {
    throw new Error(validation.error || 'Invalid address');
  }
  return validation.normalized!.toLowerCase();
}

/**
 * Creates an ethers provider for Conflux eSpace
 * Uses the environment URL or defaults to public RPC
 */
export function createConfluxeSpaceProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.CONFLUX_ESPACE_RPC_URL || 'https://evm.confluxrpc.com';
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Gets the bytecode of a contract at the given address
 */
export async function getContractBytecode(address: string): Promise<string | null> {
  try {
    const validation = validateAndNormalizeAddress(address);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const provider = createConfluxeSpaceProvider();
    const code = await provider.getCode(validation.normalized!);
    
    return code === '0x' ? null : code;
  } catch (error) {
    console.error('Error getting contract bytecode:', error);
    return null;
  }
}

/**
 * Checks if an address contains contract code
 */
export async function isContract(address: string): Promise<boolean> {
  const code = await getContractBytecode(address);
  return code !== null && code !== '0x';
}

/**
 * Address validation middleware for API routes
 */
export function createAddressValidationError(address: string): { error: string; status: number } {
  const validation = validateAndNormalizeAddress(address);
  
  if (!validation.isValid) {
    return {
      error: validation.error || 'Invalid address format',
      status: 400
    };
  }

  // Additional length check
  if (address.length < 10) {
    return {
      error: 'Address appears to be too short',
      status: 400
    };
  }

  // This shouldn't happen if validation passed, but just in case
  return {
    error: 'Unknown address validation error',
    status: 400
  };
}