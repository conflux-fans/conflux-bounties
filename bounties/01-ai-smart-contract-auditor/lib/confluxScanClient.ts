import axios from 'axios';

// Use environment variable or fallback to default eSpace API
const CONFLUXSCAN_API_URL = process.env.CONFLUXSCAN_API_URL || 'https://evmapi.confluxscan.org';
const CONFLUXSCAN_API_KEY = process.env.CONFLUXSCAN_API_KEY;

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

export interface ContractSource {
  name: string;
  content: string;
}

export interface VerifiedContract {
  address: string;
  contractName: string;
  sources: ContractSource[];
  compiler: {
    version: string;
    settings?: any;
  };
  constructorArguments?: string;
  abi?: any[];
}

export async function getContractSource(address: string): Promise<string> {
  console.log(`[ConfluxScan] Fetching contract source for address: ${address}`);
  
  const apiUrl = `${CONFLUXSCAN_API_URL}/api?module=contract&action=getsourcecode&address=${address}`;
  if (CONFLUXSCAN_API_KEY) {
    console.log(`[ConfluxScan] Using API key for enhanced rate limits`);
  }
  console.log(`[ConfluxScan] API URL: ${apiUrl}`);
  
  try {
    const requestConfig: any = {
      url: apiUrl,
      method: 'GET'
    };

    // Add API key if available
    if (CONFLUXSCAN_API_KEY) {
      requestConfig.params = { apikey: CONFLUXSCAN_API_KEY };
    }

    const response = await axios(requestConfig);
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

/**
 * Get full verified contract details including multi-file sources
 */
export async function getVerifiedContract(address: string): Promise<VerifiedContract> {
  console.log(`[ConfluxScan] Fetching verified contract details for address: ${address}`);
  
  const apiUrl = `${CONFLUXSCAN_API_URL}/api?module=contract&action=getsourcecode&address=${address}`;
  console.log(`[ConfluxScan] API URL: ${apiUrl}`);
  
  try {
    const requestConfig: any = {
      url: apiUrl,
      method: 'GET'
    };

    // Add API key if available
    if (CONFLUXSCAN_API_KEY) {
      requestConfig.params = { apikey: CONFLUXSCAN_API_KEY };
    }

    const response = await axios(requestConfig);
    console.log(`[ConfluxScan] Response status: ${response.status}`);
    
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
    
    if (!sourceCode || sourceCode.trim().length === 0) {
      console.log(`[ConfluxScan] No source code found in result`);
      throw new ContractNotFound(address);
    }

    // Parse multi-file sources if present
    const sources: ContractSource[] = [];
    
    try {
      // Check if it's a JSON with multiple files (Solidity Standard JSON Input)
      if (sourceCode.startsWith('{') && sourceCode.includes('"sources"')) {
        const parsed = JSON.parse(sourceCode);
        
        if (parsed.sources) {
          // Standard JSON format
          for (const [fileName, fileData] of Object.entries(parsed.sources)) {
            const content = (fileData as any).content;
            if (content) {
              sources.push({
                name: fileName,
                content: removeComments(content)
              });
            }
          }
        }
      } 
      // Check if it's wrapped in extra braces (some APIs return this format)
      else if (sourceCode.startsWith('{{') && sourceCode.endsWith('}}')) {
        const unwrapped = sourceCode.slice(1, -1);
        const parsed = JSON.parse(unwrapped);
        
        if (parsed.sources) {
          for (const [fileName, fileData] of Object.entries(parsed.sources)) {
            const content = (fileData as any).content;
            if (content) {
              sources.push({
                name: fileName,
                content: removeComments(content)
              });
            }
          }
        }
      }
    } catch (parseError) {
      console.log(`[ConfluxScan] Failed to parse multi-file format, treating as single file`);
    }

    // If no multi-file sources found, treat as single file
    if (sources.length === 0) {
      const contractName = contractData.ContractName || 'Contract';
      const fileName = `${contractName}.sol`;
      sources.push({
        name: fileName,
        content: removeComments(sourceCode)
      });
    }

    console.log(`[ConfluxScan] Parsed ${sources.length} source files for contract ${address}`);

    return {
      address: address.toLowerCase(),
      contractName: contractData.ContractName || 'Contract',
      sources,
      compiler: {
        version: contractData.CompilerVersion || 'unknown',
        settings: contractData.Settings ? JSON.parse(contractData.Settings) : undefined
      },
      constructorArguments: contractData.ConstructorArguments,
      abi: contractData.ABI ? JSON.parse(contractData.ABI) : undefined
    };

  } catch (error) {
    console.error(`[ConfluxScan] Error fetching verified contract:`, error);
    
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

/**
 * Get combined source code from all files in a verified contract
 */
export async function getCombinedContractSource(address: string): Promise<string> {
  const verifiedContract = await getVerifiedContract(address);
  
  if (verifiedContract.sources.length === 1) {
    return verifiedContract.sources[0].content;
  }

  // Combine multiple files with clear separators and line preservation
  let combinedSource = '';
  let currentLine = 1;
  
  for (const source of verifiedContract.sources) {
    combinedSource += `// File: ${source.name}\n`;
    combinedSource += `// Lines ${currentLine}-${currentLine + source.content.split('\n').length - 1}\n\n`;
    combinedSource += source.content;
    combinedSource += '\n\n';
    
    currentLine += source.content.split('\n').length + 3; // +3 for the comment lines and spacing
  }

  return combinedSource.trim();
}