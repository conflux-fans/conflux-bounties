import axios from 'axios';

const CONFLUXSCAN_API_URL = 'https://evmapi.confluxscan.org';

export class ContractNotFound extends Error {
  constructor(address: string) {
    super(`Contract not found: ${address}`);
    this.name = 'ContractNotFound';
  }
}

export async function getContractSource(address: string): Promise<string> {
  try {
    const response = await axios.get(`${CONFLUXSCAN_API_URL}/contracts/${address}`);
    return response.data.sourceCode || response.data.source_code || response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      throw new ContractNotFound(address);
    }
    throw error;
  }
}