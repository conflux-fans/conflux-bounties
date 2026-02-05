/**
 * ConfluxScan API Client
 * 
 * Provides live blockchain data queries for the Conflux Expert Agent
 * API Docs: https://evmapi.confluxscan.org/doc
 */

const API_BASE = 'https://evmapi.confluxscan.org/api';

interface ConfluxScanResponse<T> {
    status: string;
    message: string;
    result: T;
}

/**
 * Make a request to ConfluxScan API
 */
async function fetchConfluxScan<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(API_BASE);
    url.searchParams.set('module', params.module || 'account');
    url.searchParams.set('action', params.action || '');

    // Add remaining params
    Object.entries(params).forEach(([key, value]) => {
        if (key !== 'module' && key !== 'action') {
            url.searchParams.set(key, value);
        }
    });

    // Add API key if available
    if (process.env.CONFLUXSCAN_API_KEY) {
        url.searchParams.set('apikey', process.env.CONFLUXSCAN_API_KEY);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`ConfluxScan API error: ${response.status}`);
    }

    const data: ConfluxScanResponse<T> = await response.json();
    if (data.status !== '1' && data.message !== 'OK') {
        throw new Error(`ConfluxScan error: ${data.message}`);
    }

    return data.result;
}

/**
 * Get account balance in CFX
 */
export async function getAccountBalance(address: string): Promise<string> {
    const result = await fetchConfluxScan<string>('', {
        module: 'account',
        action: 'balance',
        address
    });

    // Convert from Drip to CFX (1 CFX = 10^18 Drip)
    const cfx = (BigInt(result) / BigInt(10 ** 18)).toString();
    return cfx;
}

/**
 * Get transaction count for an address
 */
export async function getTransactionCount(address: string): Promise<number> {
    const result = await fetchConfluxScan<string>('', {
        module: 'account',
        action: 'txcount',
        address
    });
    return parseInt(result, 10);
}

/**
 * Get recent transactions for an address
 */
export async function getRecentTransactions(address: string, limit: number = 5) {
    const result = await fetchConfluxScan<Array<{
        hash: string;
        from: string;
        to: string;
        value: string;
        timestamp: string;
    }>>('', {
        module: 'account',
        action: 'txlist',
        address,
        page: '1',
        offset: limit.toString(),
        sort: 'desc'
    });

    return result.map(tx => ({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: (BigInt(tx.value) / BigInt(10 ** 18)).toString() + ' CFX',
        timestamp: new Date(parseInt(tx.timestamp) * 1000).toISOString()
    }));
}

/**
 * Get contract info
 */
export async function getContractInfo(address: string) {
    try {
        const result = await fetchConfluxScan<{
            ContractName: string;
            CompilerVersion: string;
            SourceCode: string;
        }>('', {
            module: 'contract',
            action: 'getsourcecode',
            address
        });

        return {
            name: result.ContractName || 'Unknown',
            compiler: result.CompilerVersion || 'Unknown',
            hasSource: !!result.SourceCode
        };
    } catch {
        return null;
    }
}

/**
 * Get current CFX price
 */
export async function getCFXPrice(): Promise<{ usd: number; btc: number } | null> {
    try {
        const result = await fetchConfluxScan<{
            cfxusd: string;
            cfxbtc: string;
        }>('', {
            module: 'stats',
            action: 'cfxprice'
        });

        return {
            usd: parseFloat(result.cfxusd),
            btc: parseFloat(result.cfxbtc)
        };
    } catch {
        return null;
    }
}

/**
 * Get network statistics
 */
export async function getNetworkStats() {
    try {
        const result = await fetchConfluxScan<{
            TotalTransactions: string;
            TotalAccounts: string;
            TPS: string;
        }>('', {
            module: 'stats',
            action: 'supply'
        });

        return {
            totalTransactions: result.TotalTransactions,
            totalAccounts: result.TotalAccounts,
            tps: result.TPS
        };
    } catch {
        return null;
    }
}

/**
 * Tool definitions for the AI agent
 */
export const CONFLUXSCAN_TOOLS = [
    {
        name: 'get_account_balance',
        description: 'Get the CFX balance of a Conflux eSpace address',
        parameters: { address: 'The wallet address to check' }
    },
    {
        name: 'get_transaction_count',
        description: 'Get the number of transactions for an address',
        parameters: { address: 'The wallet address to check' }
    },
    {
        name: 'get_recent_transactions',
        description: 'Get recent transactions for an address',
        parameters: { address: 'The wallet address to check' }
    },
    {
        name: 'get_cfx_price',
        description: 'Get the current CFX token price in USD and BTC',
        parameters: {}
    },
    {
        name: 'get_contract_info',
        description: 'Get information about a verified smart contract',
        parameters: { address: 'The contract address to check' }
    }
];

/**
 * Execute a tool by name
 */
export async function executeTool(toolName: string, params: Record<string, string>): Promise<string> {
    try {
        switch (toolName) {
            case 'get_account_balance': {
                const balance = await getAccountBalance(params.address);
                return `Account ${params.address} has a balance of ${balance} CFX`;
            }
            case 'get_transaction_count': {
                const count = await getTransactionCount(params.address);
                return `Account ${params.address} has ${count} transactions`;
            }
            case 'get_recent_transactions': {
                const txs = await getRecentTransactions(params.address);
                return `Recent transactions for ${params.address}:\n${txs.map(tx =>
                    `- ${tx.value} from ${tx.from.slice(0, 10)}... to ${tx.to.slice(0, 10)}... at ${tx.timestamp}`
                ).join('\n')}`;
            }
            case 'get_cfx_price': {
                const price = await getCFXPrice();
                if (!price) return 'Unable to fetch CFX price';
                return `Current CFX price: $${price.usd.toFixed(4)} USD (${price.btc.toFixed(8)} BTC)`;
            }
            case 'get_contract_info': {
                const info = await getContractInfo(params.address);
                if (!info) return `No verified contract found at ${params.address}`;
                return `Contract: ${info.name}, Compiler: ${info.compiler}, Source verified: ${info.hasSource}`;
            }
            default:
                return `Unknown tool: ${toolName}`;
        }
    } catch (error) {
        return `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
}
