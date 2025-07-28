import axios from 'axios';

const CONFLUXSCAN_API_URL = 'https://evmapi.confluxscan.org';

/**
 * Removes comments from Solidity source code to prevent AI auditor confusion
 * Handles both single-line and multi-line comments
 * Preserves strings that might contain comment-like syntax
 */
function removeComments(sourceCode: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  let inSingleLineComment = false;
  let inMultiLineComment = false;
  
  while (i < sourceCode.length) {
    const char = sourceCode[i];
    const nextChar = sourceCode[i + 1];
    
    // Handle string literals (preserve comment-like syntax in strings)
    if (!inSingleLineComment && !inMultiLineComment) {
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
        result += char;
        i++;
        continue;
      } else if (inString && char === stringChar && sourceCode[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
        result += char;
        i++;
        continue;
      }
    }
    
    // If we're in a string, just add the character
    if (inString) {
      result += char;
      i++;
      continue;
    }
    
    // Handle comment start patterns
    if (!inSingleLineComment && !inMultiLineComment) {
      if (char === '/' && nextChar === '/') {
        inSingleLineComment = true;
        i += 2;
        continue;
      } else if (char === '/' && nextChar === '*') {
        inMultiLineComment = true;
        i += 2;
        continue;
      }
    }
    
    // Handle comment end patterns
    if (inSingleLineComment && char === '\n') {
      inSingleLineComment = false;
      result += char; // Preserve line breaks
      i++;
      continue;
    }
    
    if (inMultiLineComment && char === '*' && nextChar === '/') {
      inMultiLineComment = false;
      i += 2;
      // Add spaces to maintain column positions
      result += '  ';
      continue;
    }
    
    // Skip characters if we're in a comment
    if (inSingleLineComment || inMultiLineComment) {
      // For multi-line comments, preserve line breaks
      if (inMultiLineComment && char === '\n') {
        result += char;
      } else if (inMultiLineComment) {
        result += ' '; // Replace comment chars with spaces to maintain positions
      }
      i++;
      continue;
    }
    
    // Normal character - add to result
    result += char;
    i++;
  }
  
  return result;
}

export class ContractNotFound extends Error {
  constructor(address: string) {
    super(`Contract not found: ${address}`);
    this.name = 'ContractNotFound';
  }
}

export async function getContractSource(address: string): Promise<string> {
  console.log(`[ConfluxScan] Fetching contract source for address: ${address}`);
  
  const apiUrl = `${CONFLUXSCAN_API_URL}/api?module=contract&action=getsourcecode&address=${address}`;
  console.log(`[ConfluxScan] API URL: ${apiUrl}`);
  
  try {
    const response = await axios.get(apiUrl);
    console.log(`[ConfluxScan] Response status: ${response.status}`);
    console.log(`[ConfluxScan] Response data:`, JSON.stringify(response.data, null, 2));
    
    // Check if the API returned an error status
    if (response.data.status === '0') {
      console.log(`[ConfluxScan] API returned error status:`, response.data.message);
      throw new ContractNotFound(address);
    }
    
    // Extract source code from the result array
    const result = response.data.result;
    if (!result || !Array.isArray(result) || result.length === 0) {
      console.log(`[ConfluxScan] No result data found`);
      throw new ContractNotFound(address);
    }
    
    const contractData = result[0];
    const sourceCode = contractData.SourceCode || contractData.sourceCode;
    console.log(`[ConfluxScan] Extracted source code length:`, sourceCode?.length || 0);
    
    if (!sourceCode || sourceCode.trim().length === 0) {
      console.log(`[ConfluxScan] No source code found in result`);
      throw new ContractNotFound(address);
    }
    
    // Remove comments to prevent AI auditor confusion
    const cleanedSourceCode = removeComments(sourceCode);
    console.log(`[ConfluxScan] Source code cleaned, original length: ${sourceCode.length}, cleaned length: ${cleanedSourceCode.length}`);
    
    return cleanedSourceCode;
  } catch (error) {
    console.error(`[ConfluxScan] Error fetching contract:`, error);
    
    if (axios.isAxiosError(error)) {
      console.log(`[ConfluxScan] Axios error status:`, error.response?.status);
      console.log(`[ConfluxScan] Axios error data:`, error.response?.data);
      
      if (error.response?.status === 404) {
        throw new ContractNotFound(address);
      }
    }
    
    // If it's already a ContractNotFound error, re-throw it
    if (error instanceof ContractNotFound) {
      throw error;
    }
    
    throw error;
  }
}