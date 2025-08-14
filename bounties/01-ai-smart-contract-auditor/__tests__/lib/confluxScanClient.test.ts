import axios from 'axios';
import { getContractSource, ContractNotFound } from '../../lib/confluxScanClient';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('confluxScanClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables to ensure consistent test behavior
    delete process.env.CONFLUXSCAN_API_KEY;
    delete process.env.CONFLUXSCAN_API_URL;
  });

  describe('ContractNotFound', () => {
    it('should create error with correct message and name', () => {
      const address = 'cfx:123456789';
      const error = new ContractNotFound(address);
      
      expect(error.message).toBe(`Contract not found: ${address}`);
      expect(error.name).toBe('ContractNotFound');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('getContractSource', () => {
    const testAddress = 'cfx:123456789abcdef';
    const sampleSourceCode = `pragma solidity ^0.8.0;

contract TestContract {
    uint256 public balance;
    // This is a comment
    function deposit() public payable {
        balance += msg.value; /* inline comment */
    }
}`;

    const expectedCleanedCode = `pragma solidity ^0.8.0;

contract TestContract {
    uint256 public balance;
    
    function deposit() public payable {
        balance += msg.value;   
    }
}`;

    it('should fetch and return cleaned source code successfully', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              SourceCode: sampleSourceCode,
              ContractName: 'TestContract'
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getContractSource(testAddress);
      
      expect(mockedAxios).toHaveBeenCalledWith({
        url: `https://evmapi.confluxscan.org/api?module=contract&action=getsourcecode&address=${testAddress}`,
        method: 'GET'
      });
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
      // Should have removed comments
      expect(result).not.toContain('// This is a comment');
      expect(result).not.toContain('/* inline comment */');
    });

    it('should handle sourceCode field (lowercase)', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              sourceCode: sampleSourceCode, // lowercase
              ContractName: 'TestContract'
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getContractSource(testAddress);
      expect(result).toBeTruthy();
    });

    it('should throw ContractNotFound when API returns error status', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '0',
          message: 'Contract source code not verified'
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      await expect(getContractSource(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should throw ContractNotFound when result is empty', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: []
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      await expect(getContractSource(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should throw ContractNotFound when result is null', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: null
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      await expect(getContractSource(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should throw ContractNotFound when no source code in result', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              ContractName: 'TestContract'
              // No SourceCode or sourceCode field
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      await expect(getContractSource(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should throw ContractNotFound when source code is empty', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              SourceCode: '   ', // only whitespace
              ContractName: 'TestContract'
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      await expect(getContractSource(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should handle 404 axios errors', async () => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 404,
          data: 'Not Found'
        }
      };

      mockedAxios.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(getContractSource(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should handle other axios errors', async () => {
      const axiosError = new Error('Server Error');
      Object.assign(axiosError, {
        isAxiosError: true,
        response: {
          status: 500,
          data: 'Server Error'
        }
      });

      mockedAxios.mockRejectedValueOnce(axiosError);
      mockedAxios.isAxiosError.mockReturnValueOnce(true);

      await expect(getContractSource(testAddress)).rejects.toThrow('Server Error');
    });

    it('should handle non-axios errors', async () => {
      const genericError = new Error('Network timeout');

      mockedAxios.mockRejectedValueOnce(genericError);
      mockedAxios.isAxiosError.mockReturnValueOnce(false);

      await expect(getContractSource(testAddress)).rejects.toThrow(genericError);
    });

    it('should preserve ContractNotFound errors when re-throwing', async () => {
      const contractNotFoundError = new ContractNotFound(testAddress);

      mockedAxios.mockRejectedValueOnce(contractNotFoundError);
      mockedAxios.isAxiosError.mockReturnValueOnce(false);

      await expect(getContractSource(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should properly remove single-line comments', async () => {
      const codeWithComments = `pragma solidity ^0.8.0;
// This is a single line comment
contract Test {
    uint256 value; // inline comment
}`;

      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [{ SourceCode: codeWithComments }]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getContractSource(testAddress);
      expect(result).not.toContain('// This is a single line comment');
      expect(result).not.toContain('// inline comment');
    });

    it('should properly remove multi-line comments', async () => {
      const codeWithComments = `pragma solidity ^0.8.0;
/* This is a 
   multi-line comment */
contract Test {
    uint256 value; /* inline block comment */
}`;

      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [{ SourceCode: codeWithComments }]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getContractSource(testAddress);
      expect(result).not.toContain('/* This is a');
      expect(result).not.toContain('multi-line comment */');
      expect(result).not.toContain('/* inline block comment */');
    });

    it('should preserve strings with comment-like content', async () => {
      const codeWithStrings = `pragma solidity ^0.8.0;
contract Test {
    string message = "This // is not a comment";
    string multiLine = "This /* is not a comment */";
}`;

      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [{ SourceCode: codeWithStrings }]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getContractSource(testAddress);
      expect(result).toContain('"This // is not a comment"');
      expect(result).toContain('"This /* is not a comment */"');
    });

    it('should handle escaped quotes in strings', async () => {
      const codeWithEscapes = `pragma solidity ^0.8.0;
contract Test {
    string message = "This is a \\"quote\\" in a string"; // This is a comment
}`;

      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [{ SourceCode: codeWithEscapes }]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getContractSource(testAddress);
      expect(result).toContain('\\"quote\\"');
      expect(result).not.toContain('// This is a comment');
    });
  });
});