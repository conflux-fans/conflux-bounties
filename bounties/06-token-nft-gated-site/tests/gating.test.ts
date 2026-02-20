import { describe, it, expect, vi } from 'vitest';
import { evaluateRules, type GatingRuleConfig, type GatingResult } from '../src/lib/gating';

// Mock viem's createPublicClient
vi.mock('viem', async () => {
  const actual = await vi.importActual('viem');
  return {
    ...actual,
    createPublicClient: () => ({
      readContract: vi.fn(async ({ functionName, args }: { functionName: string; args: unknown[] }) => {
        // Simulate balances based on contract address
        const contract = args.length > 0 ? '' : '';
        // Default: return balance of 1000n for ERC20, 1n for ERC721, 5n for ERC1155
        if (functionName === 'balanceOf') {
          if (args.length === 1) {
            // ERC20 or ERC721
            return 1000n;
          }
          if (args.length === 2) {
            // ERC1155
            return 5n;
          }
        }
        return 0n;
      }),
    }),
  };
});

const userAddress = '0x1234567890abcdef1234567890abcdef12345678';

describe('Gating Engine', () => {
  describe('evaluateRules with ALL logic', () => {
    it('should grant when all rules pass', async () => {
      const rules: GatingRuleConfig[] = [
        { contractAddress: '0xaaa', contractType: 'ERC20', chainId: 1030, minBalance: '100' },
        { contractAddress: '0xbbb', contractType: 'ERC20', chainId: 1030, minBalance: '500' },
      ];

      const result = await evaluateRules(userAddress, rules, 'ALL');
      expect(result.granted).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.every((r) => r.passed)).toBe(true);
    });

    it('should deny when any rule fails with ALL logic', async () => {
      const rules: GatingRuleConfig[] = [
        { contractAddress: '0xaaa', contractType: 'ERC20', chainId: 1030, minBalance: '100' },
        { contractAddress: '0xbbb', contractType: 'ERC20', chainId: 1030, minBalance: '5000' },
      ];

      const result = await evaluateRules(userAddress, rules, 'ALL');
      expect(result.granted).toBe(false);
    });
  });

  describe('evaluateRules with ANY logic', () => {
    it('should grant when at least one rule passes', async () => {
      const rules: GatingRuleConfig[] = [
        { contractAddress: '0xaaa', contractType: 'ERC20', chainId: 1030, minBalance: '5000' },
        { contractAddress: '0xbbb', contractType: 'ERC20', chainId: 1030, minBalance: '100' },
      ];

      const result = await evaluateRules(userAddress, rules, 'ANY');
      expect(result.granted).toBe(true);
    });
  });

  describe('empty rules', () => {
    it('should grant access when no rules configured', async () => {
      const result = await evaluateRules(userAddress, [], 'ALL');
      expect(result.granted).toBe(true);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('ERC721 rules', () => {
    it('should check NFT ownership', async () => {
      const rules: GatingRuleConfig[] = [
        { contractAddress: '0xnft', contractType: 'ERC721', chainId: 1030, minBalance: '1' },
      ];

      const result = await evaluateRules(userAddress, rules, 'ALL');
      expect(result.granted).toBe(true);
      expect(result.results[0].contractType).toBe('ERC721');
    });
  });

  describe('ERC1155 rules', () => {
    it('should check token quantity', async () => {
      const rules: GatingRuleConfig[] = [
        { contractAddress: '0x1155', contractType: 'ERC1155', chainId: 1030, minBalance: '3', tokenId: '1' },
      ];

      const result = await evaluateRules(userAddress, rules, 'ALL');
      expect(result.granted).toBe(true);
      expect(result.results[0].contractType).toBe('ERC1155');
    });
  });
});
