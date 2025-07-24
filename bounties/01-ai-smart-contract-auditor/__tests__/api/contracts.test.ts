import { GET } from '../../app/api/contracts/[address]/route';
import { getContractSource, ContractNotFound } from '../../lib/confluxScanClient';
import { NextRequest } from 'next/server';

// Mock the confluxScanClient module
jest.mock('../../lib/confluxScanClient');

const mockGetContractSource = getContractSource as jest.MockedFunction<typeof getContractSource>;

describe('/api/contracts/[address]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return contract source for valid address', async () => {
      const mockSource = 'contract TestContract { }';
      mockGetContractSource.mockResolvedValue(mockSource);

      const request = new NextRequest('http://localhost:3000/api/contracts/0x1234567890123456789012345678901234567890');
      const params = { address: '0x1234567890123456789012345678901234567890' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.source).toBe(mockSource);
      expect(mockGetContractSource).toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });

    it('should return 400 for invalid address format', async () => {
      const request = new NextRequest('http://localhost:3000/api/contracts/invalid-address');
      const params = { address: 'invalid-address' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid address format');
      expect(mockGetContractSource).not.toHaveBeenCalled();
    });

    it('should return 404 when contract not found', async () => {
      mockGetContractSource.mockRejectedValue(new ContractNotFound('0x1234567890123456789012345678901234567890'));

      const request = new NextRequest('http://localhost:3000/api/contracts/0x1234567890123456789012345678901234567890');
      const params = { address: '0x1234567890123456789012345678901234567890' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Contract not found');
    });

    it('should return 500 for unexpected errors', async () => {
      mockGetContractSource.mockRejectedValue(new Error('Network error'));

      const request = new NextRequest('http://localhost:3000/api/contracts/0x1234567890123456789012345678901234567890');
      const params = { address: '0x1234567890123456789012345678901234567890' };

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should validate address format correctly', async () => {
      const validAddresses = [
        '0x1234567890123456789012345678901234567890',
        '0xAbCdEf1234567890123456789012345678901234',
      ];

      const invalidAddresses = [
        '1234567890123456789012345678901234567890', // missing 0x
        '0x123456789012345678901234567890123456789', // too short
        '0x12345678901234567890123456789012345678901', // too long
        '0x123456789012345678901234567890123456789g', // invalid character
      ];

      mockGetContractSource.mockResolvedValue('test');

      for (const address of validAddresses) {
        const request = new NextRequest(`http://localhost:3000/api/contracts/${address}`);
        const response = await GET(request, { params: { address } });
        expect(response.status).toBe(200);
      }

      for (const address of invalidAddresses) {
        const request = new NextRequest(`http://localhost:3000/api/contracts/${address}`);
        const response = await GET(request, { params: { address } });
        expect(response.status).toBe(400);
      }
    });
  });
});