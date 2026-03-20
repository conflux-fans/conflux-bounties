const CONFLUXSCAN_API_URL = process.env.CONFLUXSCAN_API_URL || 'https://evmapi.confluxscan.io';

interface ConfluxScanContractResponse {
  status: string;
  message: string;
  result: Array<{
    SourceCode: string;
    ABI: string;
    ContractName: string;
    CompilerVersion: string;
    OptimizationUsed: string;
    Runs: string;
    ConstructorArguments: string;
    EVMVersion: string;
    Library: string;
    LicenseType: string;
    Proxy: string;
    Implementation: string;
    SwarmSource: string;
  }> | null;
}

export interface ContractSource {
  address: string;
  name: string;
  compilerVersion: string;
  sourceCode: string;
  abi: object | null;
}

export async function fetchContractSource(address: string): Promise<ContractSource> {
  const url = `${CONFLUXSCAN_API_URL}/api?module=contract&action=getsourcecode&address=${address}`;
  
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  const apiKey = process.env.CONFLUXSCAN_API_KEY;
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`ConfluxScan API error: ${res.status}`);

  const data: ConfluxScanContractResponse = await res.json();

  if (data.status !== '1' || !data.result || data.result.length === 0) {
    throw new Error('Contract not found or not verified on ConfluxScan');
  }

  const contract = data.result[0];
  
  if (!contract.SourceCode || contract.SourceCode.trim() === '') {
    throw new Error('Contract source code is not available. The contract may not be verified.');
  }

  let abi = null;
  try {
    abi = JSON.parse(contract.ABI);
  } catch {
    abi = null;
  }

  return {
    address: address.toLowerCase(),
    name: contract.ContractName,
    compilerVersion: contract.CompilerVersion,
    sourceCode: contract.SourceCode,
    abi,
  };
}

export async function checkContractVerified(address: string): Promise<boolean> {
  try {
    await fetchContractSource(address);
    return true;
  } catch {
    return false;
  }
}
