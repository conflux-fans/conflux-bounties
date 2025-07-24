import { getContractSource, ContractNotFound } from '../lib/confluxScanClient';
import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';

const mock = new MockAdapter(axios);

describe('confluxScanClient', () => {
  afterEach(() => {
    mock.reset();
  });

  describe('getContractSource', () => {
    const testAddress = '0x1234567890123456789012345678901234567890';

    it('should return contract source on successful API call', async () => {
      const mockSource = 'contract TestContract { }';
      mock.onGet(`https://evmapi.confluxscan.org/contracts/${testAddress}`)
          .reply(200, { sourceCode: mockSource });

      const result = await getContractSource(testAddress);
      expect(result).toBe(mockSource);
    });

    it('should handle alternative response format (source_code)', async () => {
      const mockSource = 'contract TestContract { }';
      mock.onGet(`https://evmapi.confluxscan.org/contracts/${testAddress}`)
          .reply(200, { source_code: mockSource });

      const result = await getContractSource(testAddress);
      expect(result).toBe(mockSource);
    });

    it('should handle raw response data', async () => {
      const mockSource = 'contract TestContract { }';
      mock.onGet(`https://evmapi.confluxscan.org/contracts/${testAddress}`)
          .reply(200, mockSource);

      const result = await getContractSource(testAddress);
      expect(result).toBe(mockSource);
    });

    it('should throw ContractNotFound on 404', async () => {
      mock.onGet(`https://evmapi.confluxscan.org/contracts/${testAddress}`)
          .reply(404);

      await expect(getContractSource(testAddress))
        .rejects
        .toThrow(ContractNotFound);
      
      await expect(getContractSource(testAddress))
        .rejects
        .toThrow(`Contract not found: ${testAddress}`);
    });

    it('should throw original error on non-404 errors', async () => {
      mock.onGet(`https://evmapi.confluxscan.org/contracts/${testAddress}`)
          .reply(500, { message: 'Server error' });

      await expect(getContractSource(testAddress))
        .rejects
        .toThrow();
    });

    it('should throw network errors', async () => {
      mock.onGet(`https://evmapi.confluxscan.org/contracts/${testAddress}`)
          .networkError();

      await expect(getContractSource(testAddress))
        .rejects
        .toThrow();
    });
  });
});