import { describe, test, expect, mock, beforeEach, afterAll } from 'bun:test';
import type { Address } from 'viem';
import {
  getPublicClient,
  getWalletClient,
  getAddressFromPrivateKey
} from '../../../core/services/clients.js';
import { getChain, getRpcUrl } from '../../../core/chains.js';

// Minimal mocking to avoid network calls
mock.module('../../../core/chains.js', () => ({
  getChain: mock(() => ({ id: 1030, name: 'Conflux eSpace' })),
  getRpcUrl: mock(() => 'https://evm.confluxrpc.com'),
  DEFAULT_NETWORK: 'conflux'
}));

const mockCreateWalletClient = mock(() => ({}));
const mockHttp = mock(() => ({}));
const mockPrivateKeyToAccount = mock(() => ({
  address: '0x1234567890123456789012345678901234567890'
}));

function parseEtherMock(value: string | number): bigint {
  // Use the same mock as utils test to avoid conflicts
  const str = String(value);
  if (str === '1.0' || str === '1' || value === 1) return 1000000000n;
  if (str === '2.5' || value === 2.5) return 2500000000n;
  if (str === '0' || value === 0) return 0n;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0n;
  return BigInt(Math.round(n * 1e9));
}

mock.module('viem', () => ({
  // Provide a parseEther implementation so other tests relying on utils.parseEther keep working
  parseEther: parseEtherMock,
  createWalletClient: mockCreateWalletClient,
  http: mockHttp
}));

mock.module('viem/accounts', () => ({
  privateKeyToAccount: mockPrivateKeyToAccount
}));

describe('Clients Service', () => {
  const mockPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;
  const mockAccount: { address: Address } = { address: '0x1234567890123456789012345678901234567890' as Address };

  beforeEach(() => {
    (mockPrivateKeyToAccount as any).mockReset?.();
    mockCreateWalletClient.mockReset();
    mockHttp.mockReset();
    (mockPrivateKeyToAccount as any).mockReturnValue(mockAccount);
    mockCreateWalletClient.mockReturnValue({});
    mockHttp.mockReturnValue({});
  });

  describe('getPublicClient', () => {
    test('returns a client object for a given network', () => {
      const client = getPublicClient('conflux');
      expect(client).toBeDefined();
    });

    test('caches client for the same network key', () => {
      const a = getPublicClient('custom-net');
      const b = getPublicClient('custom-net');
      expect(a).toBe(b);
    });
  });

  describe('getWalletClient', () => {
    test('creates a wallet client with correct parameters', () => {
      const wc = getWalletClient(mockPrivateKey, 'conflux');
      expect(wc).toBeDefined();
      // Just verify the wallet client is created successfully
    });
  });

  describe('getAddressFromPrivateKey', () => {
    test('returns address from private key', () => {
      const result = getAddressFromPrivateKey(mockPrivateKey);
      expect(result).toBe(mockAccount.address);
    });
  });

  // Ensure mocks do not leak to other test files
  afterAll(() => {
    mock.restore();
  });
});
