import { NextRequest } from 'next/server';
import { GET } from '@/app/api/contracts/[address]/route';
import { getContractSource } from '@/lib/confluxScanClient';
import { validateAndNormalizeAddress } from '@/lib/addressUtils';

// Mock the dependencies
jest.mock('@/lib/confluxScanClient', () => ({
  getContractSource: jest.fn(),
  getVerifiedContract: jest.fn(),
  ContractNotFound: class ContractNotFound extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ContractNotFound';
    }
  }
}));
jest.mock('@/lib/addressUtils', () => ({
  validateAndNormalizeAddress: jest.fn()
}));

const mockGetContractSource = getContractSource as jest.MockedFunction<typeof getContractSource>;
const mockValidateAndNormalizeAddress = validateAndNormalizeAddress as jest.MockedFunction<typeof validateAndNormalizeAddress>;

describe('/api/contracts/[address]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 400 for invalid address', async () => {
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: false,
        error: 'Invalid address format'
      });

      const request = new NextRequest('http://localhost/api/contracts/invalid-address');
      const params = Promise.resolve({ address: 'invalid-address' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid address format');
    });

    it('should return contract source for valid address', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      const mockSource = {
        sourceCode: 'pragma solidity ^0.8.0;\ncontract Test {}',
        contractName: 'Test',
        compilerVersion: '0.8.19'
      };

      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });
      mockGetContractSource.mockResolvedValue(mockSource);

      const request = new NextRequest(`http://localhost/api/contracts/${mockAddress}`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.address).toBe(mockAddress);
      expect(data.source).toEqual(mockSource);
      expect(mockGetContractSource).toHaveBeenCalledWith(mockAddress);
    });

    it('should return 500 when contract fetch fails', async () => {
      const mockAddress = '0x1234567890123456789012345678901234567890';
      
      mockValidateAndNormalizeAddress.mockReturnValue({
        isValid: true,
        normalized: mockAddress
      });
      mockGetContractSource.mockRejectedValue(new Error('Contract not found'));

      const request = new NextRequest(`http://localhost/api/contracts/${mockAddress}`);
      const params = Promise.resolve({ address: mockAddress });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});