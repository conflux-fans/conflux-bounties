import axios from 'axios';

const CONFLUXSCAN_API_URL = 'https://evmapi.confluxscan.org';

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
    
    return sourceCode;
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