import { createPublicClient, http, erc20Abi, type Address } from 'viem';
import { getChainById } from './chains';

/** Minimal ERC721 ABI for balanceOf */
const erc721BalanceAbi = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/** Minimal ERC1155 ABI for balanceOf */
const erc1155BalanceAbi = [
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' },
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface GatingRuleConfig {
  contractAddress: string;
  contractType: 'ERC20' | 'ERC721' | 'ERC1155';
  chainId: number;
  minBalance: string;
  tokenId?: string | null;
}

export interface GatingResult {
  passed: boolean;
  balance: string;
  required: string;
  contractAddress: string;
  contractType: string;
}

function getClient(chainId: number) {
  const chain = getChainById(chainId);
  if (!chain) throw new Error(`Unsupported chain: ${chainId}`);
  return createPublicClient({ chain, transport: http() });
}

/** Check a single gating rule against a user address */
export async function checkRule(
  userAddress: string,
  rule: GatingRuleConfig,
): Promise<GatingResult> {
  const client = getClient(rule.chainId);
  const addr = userAddress as Address;
  const contract = rule.contractAddress as Address;
  let balance: bigint;

  switch (rule.contractType) {
    case 'ERC20':
      balance = await client.readContract({
        address: contract,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [addr],
      });
      break;

    case 'ERC721':
      balance = await client.readContract({
        address: contract,
        abi: erc721BalanceAbi,
        functionName: 'balanceOf',
        args: [addr],
      });
      break;

    case 'ERC1155':
      if (!rule.tokenId) throw new Error('ERC1155 rules require a tokenId');
      balance = await client.readContract({
        address: contract,
        abi: erc1155BalanceAbi,
        functionName: 'balanceOf',
        args: [addr, BigInt(rule.tokenId)],
      });
      break;

    default:
      throw new Error(`Unknown contract type: ${rule.contractType}`);
  }

  const required = BigInt(rule.minBalance);
  return {
    passed: balance >= required,
    balance: balance.toString(),
    required: rule.minBalance,
    contractAddress: rule.contractAddress,
    contractType: rule.contractType,
  };
}

/** Evaluate multiple rules with AND/OR logic */
export async function evaluateRules(
  userAddress: string,
  rules: GatingRuleConfig[],
  logic: 'ALL' | 'ANY' = 'ALL',
): Promise<{ granted: boolean; results: GatingResult[] }> {
  if (rules.length === 0) return { granted: true, results: [] };

  const results = await Promise.all(rules.map((r) => checkRule(userAddress, r)));

  const granted =
    logic === 'ALL' ? results.every((r) => r.passed) : results.some((r) => r.passed);

  return { granted, results };
}
