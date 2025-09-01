import { 
  validateAndNormalizeAddress, 
  getChecksumAddress, 
  createAddressValidationError,
  isValidEthereumAddress,
  normalizeAddressForStorage,
  createConfluxeSpaceProvider,
  getContractBytecode,
  isContract
} from '../../lib/addressUtils';

describe('addressUtils', () => {
  describe('validateAndNormalizeAddress', () => {
    it('should validate and normalize valid 0x addresses', () => {
      const testAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // USDT contract
      const result = validateAndNormalizeAddress(testAddress);
      
      console.log('Address validation result:', result);
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBeDefined();
      expect(result.normalized!.startsWith('0x')).toBe(true);
      expect(result.normalized!.length).toBe(42);
      expect(result.error).toBeUndefined();
    });

    it('should checksum addresses correctly', () => {
      const address = '0xdac17f958d2ee523a2206206994597c13d831ec7';
      const result = validateAndNormalizeAddress(address);
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    });

    it('should reject Core Space (cfx:) addresses', () => {
      const coreSpaceAddresses = [
        'cfx:123456789abcdef',
        'cfx:type.user:aarc9abycue0hhzgyrr53m6cxedgccrmmyybjgh4xg',
        'cfx:type.contract:acc7uawf5ubtnmezvhu9dhc6sghea0403y2dgpyfjp',
      ];

      coreSpaceAddresses.forEach(address => {
        const result = validateAndNormalizeAddress(address);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Core Space (cfx:) addresses are not supported');
        expect(result.normalized).toBeUndefined();
      });
    });

    it('should reject invalid addresses', () => {
      const invalidAddresses = [
        '0xdac17f958d2ee523a2206206994597c13d831e', // too short
        '0xdac17f958d2ee523a2206206994597c13d831ec7a', // too long
        '0xGGGd17f958d2ee523a2206206994597c13d831ec7', // invalid characters
        'not-an-address',
        'dac17f958d2ee523a2206206994597c13d831ec7', // missing 0x prefix
        '0x',
        '',
      ];

      invalidAddresses.forEach(address => {
        const result = validateAndNormalizeAddress(address);
        expect(result.isValid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.normalized).toBeUndefined();
      });
    });

    it('should handle null and undefined inputs', () => {
      const invalidInputs = [null, undefined] as any[];

      invalidInputs.forEach(input => {
        const result = validateAndNormalizeAddress(input);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Address is required');
        expect(result.normalized).toBeUndefined();
      });
    });

    it('should trim whitespace from addresses', () => {
      const addressWithWhitespace = '  0xdAC17F958D2ee523a2206206994597C13D831ec7  ';
      const result = validateAndNormalizeAddress(addressWithWhitespace);
      
      expect(result.isValid).toBe(true);
      expect(result.normalized).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    });
  });

  describe('getChecksumAddress', () => {
    it('should get checksum for valid addresses', () => {
      const address = '0xdac17f958d2ee523a2206206994597c13d831ec7';
      const checksummed = getChecksumAddress(address);
      
      expect(checksummed).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
    });

    it('should throw for invalid addresses', () => {
      expect(() => getChecksumAddress('invalid-address')).toThrow();
      expect(() => getChecksumAddress('cfx:123456789')).toThrow();
    });
  });

  describe('createAddressValidationError', () => {
    it('should create error response for invalid addresses', () => {
      const invalidAddress = 'cfx:123456789';
      const errorResponse = createAddressValidationError(invalidAddress);
      
      expect(errorResponse.error).toContain('Core Space (cfx:) addresses are not supported');
      expect(errorResponse.status).toBe(400);
    });

    it('should handle already valid addresses', () => {
      const validAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const errorResponse = createAddressValidationError(validAddress);
      
      expect(errorResponse.error).toBe('Unknown address validation error');
      expect(errorResponse.status).toBe(400);
    });

    it('should handle short addresses', () => {
      const shortAddress = '0x123';
      const errorResponse = createAddressValidationError(shortAddress);
      
      // Short address gets rejected by ethers validation first
      expect(errorResponse.error).toBe('Invalid Ethereum address format');
      expect(errorResponse.status).toBe(400);
    });
  });

  describe('isValidEthereumAddress', () => {
    it('should return true for valid ethereum addresses', () => {
      const validAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      expect(isValidEthereumAddress(validAddress)).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      const invalidAddress = 'invalid-address';
      expect(isValidEthereumAddress(invalidAddress)).toBe(false);
    });
  });

  describe('normalizeAddressForStorage', () => {
    it('should normalize address to lowercase', () => {
      const address = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      const result = normalizeAddressForStorage(address);
      expect(result).toBe('0xdac17f958d2ee523a2206206994597c13d831ec7');
    });

    it('should throw error for invalid addresses', () => {
      const invalidAddress = 'invalid-address';
      expect(() => normalizeAddressForStorage(invalidAddress)).toThrow();
    });
  });

  describe('createConfluxeSpaceProvider', () => {
    it('should create ethers provider', () => {
      const provider = createConfluxeSpaceProvider();
      expect(provider).toBeDefined();
      // Check the provider has connection info (ethers v6 uses _getConnection)
      expect(provider._getConnection().url).toBeDefined();
    });
  });

  describe('getContractBytecode', () => {
    it('should handle invalid addresses gracefully', async () => {
      const invalidAddress = 'invalid-address';
      const result = await getContractBytecode(invalidAddress);
      expect(result).toBeNull();
    });

    it('should handle network errors gracefully', async () => {
      // Mock a valid address but expect network to fail
      const validAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      // This should gracefully handle the network error and return null
      const result = await getContractBytecode(validAddress);
      // Can be null due to network issues, but shouldn't throw
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });

  describe('isContract', () => {
    it('should handle invalid addresses gracefully', async () => {
      const invalidAddress = 'invalid-address';
      const result = await isContract(invalidAddress);
      expect(result).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      const validAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
      // This should gracefully handle potential network issues
      const result = await isContract(validAddress);
      expect(typeof result).toBe('boolean');
    });
  });
});