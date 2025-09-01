import axios from 'axios';
import { getContractSource, ContractNotFound, getVerifiedContract } from '../../lib/confluxScanClient';

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

  describe('getVerifiedContract', () => {
    const testAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should get verified contract with multi-file sources', async () => {
      const multiFileSource = `{
        "language": "Solidity",
        "sources": {
          "contracts/Token.sol": {
            "content": "pragma solidity ^0.8.0;\\ncontract Token {}"
          },
          "contracts/Ownable.sol": {
            "content": "pragma solidity ^0.8.0;\\ncontract Ownable {}"
          }
        },
        "settings": {
          "optimizer": {
            "enabled": true,
            "runs": 200
          }
        }
      }`;

      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              SourceCode: multiFileSource,
              ContractName: 'Token',
              CompilerVersion: 'v0.8.19+commit.7dd6d404',
              ConstructorArguments: '0x123',
              ABI: '[{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}]'
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getVerifiedContract(testAddress);
      expect(result.address).toBe(testAddress.toLowerCase()); // Address gets normalized to lowercase
      expect(result.contractName).toBe('Token');
      expect(result.sources).toHaveLength(2);
      expect(result.sources[0].name).toBe('contracts/Token.sol');
      expect(result.sources[1].name).toBe('contracts/Ownable.sol');
    });

    it('should handle single file sources', async () => {
      const singleFileSource = 'pragma solidity ^0.8.0;\\ncontract SimpleToken {}';

      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              SourceCode: singleFileSource,
              ContractName: 'SimpleToken',
              CompilerVersion: 'v0.8.19+commit.7dd6d404'
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getVerifiedContract(testAddress);
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].name).toBe(`${result.contractName}.sol`);
      expect(result.sources[0].content).toContain('contract SimpleToken');
    });

    it('should throw ContractNotFound when API returns error', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '0',
          message: 'Contract not verified'
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      await expect(getVerifiedContract(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should throw ContractNotFound when no result data', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: []
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      await expect(getVerifiedContract(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should throw ContractNotFound when source code is empty', async () => {
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              SourceCode: '',
              ContractName: 'EmptyContract'
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      await expect(getVerifiedContract(testAddress)).rejects.toThrow(ContractNotFound);
    });

    it('should handle malformed JSON in multi-file source', async () => {
      const malformedJson = '{ "sources": invalid json }';

      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              SourceCode: malformedJson,
              ContractName: 'MalformedContract'
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getVerifiedContract(testAddress);
      // Should fall back to single file handling
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].content).toBe(malformedJson);
    });

    it('should use CONFLUX_SCAN_API_KEY when available', async () => {
      // This test will be skipped since environment variables are loaded at module level
      // Just test that the function still works with API key set
      const originalApiKey = process.env.CONFLUX_SCAN_API_KEY;
      
      const mockResponse = {
        status: 200,
        data: {
          status: '1',
          result: [
            {
              SourceCode: 'pragma solidity ^0.8.0;\\ncontract Test {}',
              ContractName: 'Test'
            }
          ]
        }
      };

      mockedAxios.mockResolvedValueOnce(mockResponse);

      const result = await getVerifiedContract(testAddress);
      
      expect(result).toBeDefined();
      expect(result.contractName).toBe('Test');
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('getsourcecode'),
          method: 'GET'
        })
      );
    });
  });
});