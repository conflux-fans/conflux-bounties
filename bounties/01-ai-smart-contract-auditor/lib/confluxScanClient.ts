import axios from 'axios';

const CONFLUXSCAN_API_URL = 'https://evmapi.confluxscan.org';

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
    
    if (inString) {
      result += char;
      i++;
      continue;
    }
    
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
    
    if (inSingleLineComment && char === '\n') {
      inSingleLineComment = false;
      result += char; 
      i++;
      continue;
    }
    
    if (inMultiLineComment && char === '*' && nextChar === '/') {
      inMultiLineComment = false;
      i += 2;
      result += '  ';
      continue;
    }
    
    if (inSingleLineComment || inMultiLineComment) {
      if (inMultiLineComment && char === '\n') {
        result += char;
      } else if (inMultiLineComment) {
        result += ' '; 
      }
      i++;
      continue;
    }
    
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
    
    if (response.data.status === '0') {
      console.log(`[ConfluxScan] API returned error status:`, response.data.message);
      throw new ContractNotFound(address);
    }
    
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
    
    if (error instanceof ContractNotFound) {
      throw error;
    }
    
    throw error;
  }
}