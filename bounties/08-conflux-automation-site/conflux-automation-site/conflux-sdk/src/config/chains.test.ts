import { describe, expect, it } from 'vitest';
import {
  CORE_LOCAL,
  CORE_MAINNET,
  CORE_TESTNET,
  EVM_LOCAL,
  EVM_MAINNET,
  EVM_TESTNET,
  getChainConfig,
  getCoreChains,
  getEvmChains,
  getMainnetChains,
} from '../config/chains.js';

describe('chain constants', () => {
  it('has CORE_MAINNET with expected properties', () => {
    expect(CORE_MAINNET.id).toBeDefined();
    expect(CORE_MAINNET.rpcUrls.default.http[0]).toBeDefined();
    expect(CORE_MAINNET.type).toBe('core');
    expect(CORE_MAINNET.testnet).toBe(false);
  });

  it('has EVM_MAINNET as eSpace EVM chain', () => {
    expect(EVM_MAINNET.type).toBe('evm');
    expect(EVM_MAINNET.testnet).toBe(false);
    // eSpace is EVM-compatible – RPC URL contains confluxrpc
    expect(EVM_MAINNET.rpcUrls.default.http[0]).toContain('confluxrpc');
  });

  it('has CORE_TESTNET and CORE_LOCAL defined', () => {
    expect(CORE_TESTNET.testnet).toBe(true);
    expect(CORE_LOCAL).toBeDefined();
  });

  it('has EVM_TESTNET and EVM_LOCAL defined', () => {
    expect(EVM_TESTNET.testnet).toBe(true);
    expect(EVM_LOCAL).toBeDefined();
  });
});

describe('getChainConfig', () => {
  it('returns a config for a known chain id', () => {
    const config = getChainConfig(CORE_MAINNET.id);
    expect(config).toBeDefined();
    expect(config?.id).toBe(CORE_MAINNET.id);
  });

  it('throws for an unknown chain id', () => {
    expect(() => getChainConfig('nonexistent-chain-id' as any)).toThrow();
  });
});

describe('getCoreChains', () => {
  it('returns only core-space chains', () => {
    const chains = getCoreChains();
    expect(chains.length).toBeGreaterThan(0);
    for (const chain of chains) {
      expect(chain.type).toBe('core');
    }
  });
});

describe('getEvmChains', () => {
  it('returns only evm chains', () => {
    const chains = getEvmChains();
    expect(chains.length).toBeGreaterThan(0);
    for (const chain of chains) {
      expect(chain.type).toBe('evm');
    }
  });
});

describe('getMainnetChains', () => {
  it('returns only non-testnet chains', () => {
    const chains = getMainnetChains();
    expect(chains.length).toBeGreaterThan(0);
    for (const chain of chains) {
      expect(chain.testnet).toBe(false);
    }
  });
});
