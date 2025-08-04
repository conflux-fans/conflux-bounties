import { ContractFactory } from '../ContractFactory';

describe('ContractFactory', () => {
  describe('getTestTokenABI', () => {
    it('should return a valid ERC20-like ABI', () => {
      const abi = ContractFactory.getTestTokenABI();

      expect(Array.isArray(abi)).toBe(true);
      expect(abi).toHaveLength(2);
    });

    it('should include Transfer event definition', () => {
      const abi = ContractFactory.getTestTokenABI();
      const transferEvent = abi.find(item => item.name === 'Transfer');

      expect(transferEvent).toBeDefined();
      expect(transferEvent).toMatchObject({
        anonymous: false,
        name: 'Transfer',
        type: 'event',
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'from',
            type: 'address'
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'to',
            type: 'address'
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'value',
            type: 'uint256'
          }
        ]
      });
    });

    it('should include Approval event definition', () => {
      const abi = ContractFactory.getTestTokenABI();
      const approvalEvent = abi.find(item => item.name === 'Approval');

      expect(approvalEvent).toBeDefined();
      expect(approvalEvent).toMatchObject({
        anonymous: false,
        name: 'Approval',
        type: 'event',
        inputs: [
          {
            indexed: true,
            internalType: 'address',
            name: 'owner',
            type: 'address'
          },
          {
            indexed: true,
            internalType: 'address',
            name: 'spender',
            type: 'address'
          },
          {
            indexed: false,
            internalType: 'uint256',
            name: 'value',
            type: 'uint256'
          }
        ]
      });
    });

    it('should return the same ABI on multiple calls', () => {
      const abi1 = ContractFactory.getTestTokenABI();
      const abi2 = ContractFactory.getTestTokenABI();

      expect(abi1).toEqual(abi2);
    });

    it('should have properly structured event inputs', () => {
      const abi = ContractFactory.getTestTokenABI();

      abi.forEach(event => {
        expect(event.type).toBe('event');
        expect(event.anonymous).toBe(false);
        expect(Array.isArray(event.inputs)).toBe(true);
        
        event.inputs.forEach(input => {
          expect(input).toHaveProperty('indexed');
          expect(input).toHaveProperty('internalType');
          expect(input).toHaveProperty('name');
          expect(input).toHaveProperty('type');
          expect(typeof input.indexed).toBe('boolean');
          expect(typeof input.name).toBe('string');
          expect(typeof input.type).toBe('string');
        });
      });
    });

    it('should be compatible with ethers.js Contract interface', () => {
      const abi = ContractFactory.getTestTokenABI();

      // Verify ABI structure is compatible with ethers.js
      abi.forEach(fragment => {
        expect(fragment).toHaveProperty('type');
        expect(fragment).toHaveProperty('name');
        expect(fragment).toHaveProperty('inputs');
        
        if (fragment.type === 'event') {
          expect(fragment).toHaveProperty('anonymous');
        }
      });
    });
  });

  describe('generateTestAddress', () => {
    it('should generate a valid Ethereum address with default seed', () => {
      const address = ContractFactory.generateTestAddress();

      expect(address).toMatch(/^0x[0-9a-f]{40}$/i);
      expect(address).toBe('0x0000000000000000000000000000000000000000');
    });

    it('should generate different addresses for different seeds', () => {
      const address1 = ContractFactory.generateTestAddress(1);
      const address2 = ContractFactory.generateTestAddress(2);
      const address3 = ContractFactory.generateTestAddress(100);

      expect(address1).not.toBe(address2);
      expect(address2).not.toBe(address3);
      expect(address1).not.toBe(address3);

      // All should be valid addresses
      expect(address1).toMatch(/^0x[0-9a-f]{40}$/i);
      expect(address2).toMatch(/^0x[0-9a-f]{40}$/i);
      expect(address3).toMatch(/^0x[0-9a-f]{40}$/i);
    });

    it('should generate consistent addresses for the same seed', () => {
      const seed = 42;
      const address1 = ContractFactory.generateTestAddress(seed);
      const address2 = ContractFactory.generateTestAddress(seed);

      expect(address1).toBe(address2);
    });

    it('should handle large seed values', () => {
      const largeSeed = 999999999;
      const address = ContractFactory.generateTestAddress(largeSeed);

      expect(address).toMatch(/^0x[0-9a-f]{40}$/i);
      expect(address.length).toBe(42); // 0x + 40 hex characters
    });

    it('should pad small seeds with zeros', () => {
      const address1 = ContractFactory.generateTestAddress(1);
      const address15 = ContractFactory.generateTestAddress(15);
      const address255 = ContractFactory.generateTestAddress(255);

      expect(address1).toBe('0x0000000000000000000000000000000000000001');
      expect(address15).toBe('0x000000000000000000000000000000000000000f');
      expect(address255).toBe('0x00000000000000000000000000000000000000ff');
    });

    it('should handle zero seed', () => {
      const address = ContractFactory.generateTestAddress(0);

      expect(address).toBe('0x0000000000000000000000000000000000000000');
    });

    it('should generate addresses suitable for testing', () => {
      const addresses = [];
      
      // Generate multiple test addresses
      for (let i = 0; i < 10; i++) {
        addresses.push(ContractFactory.generateTestAddress(i));
      }

      // All should be unique
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(addresses.length);

      // All should be valid Ethereum addresses
      addresses.forEach(address => {
        expect(address).toMatch(/^0x[0-9a-f]{40}$/i);
      });
    });

    it('should work with hexadecimal conversion edge cases', () => {
      // Test various seed values that might cause issues with hex conversion
      const testSeeds = [0, 1, 15, 16, 255, 256, 4095, 4096, 65535, 65536];
      
      testSeeds.forEach(seed => {
        const address = ContractFactory.generateTestAddress(seed);
        expect(address).toMatch(/^0x[0-9a-f]{40}$/i);
        expect(address.length).toBe(42);
      });
    });
  });

  describe('integration with blockchain testing', () => {
    it('should provide ABI compatible with event filtering', () => {
      const abi = ContractFactory.getTestTokenABI();
      const transferEvent = abi.find(item => item.name === 'Transfer');

      // Verify the event can be used for filtering
      expect(transferEvent?.inputs.filter(input => input.indexed)).toHaveLength(2);
      expect(transferEvent?.inputs.filter(input => !input.indexed)).toHaveLength(1);
    });

    it('should generate addresses suitable for contract deployment testing', () => {
      const contractAddress = ContractFactory.generateTestAddress(1);
      const abi = ContractFactory.getTestTokenABI();

      // These would be used together in tests
      expect(contractAddress).toBeTruthy();
      expect(abi).toBeTruthy();
      expect(contractAddress).toMatch(/^0x[0-9a-f]{40}$/i);
    });

    it('should support multiple contract instances', () => {
      const contract1Address = ContractFactory.generateTestAddress(1);
      const contract2Address = ContractFactory.generateTestAddress(2);
      const abi = ContractFactory.getTestTokenABI();

      // Can create multiple contract instances with same ABI
      expect(contract1Address).not.toBe(contract2Address);
      expect(abi).toBeTruthy();
    });
  });

  describe('ABI event signature compatibility', () => {
    it('should generate events compatible with ethers.js event parsing', () => {
      const abi = ContractFactory.getTestTokenABI();
      
      abi.forEach(eventDef => {
        // Verify event definition structure matches ethers.js expectations
        expect(eventDef.type).toBe('event');
        expect(typeof eventDef.name).toBe('string');
        expect(Array.isArray(eventDef.inputs)).toBe(true);
        expect(typeof eventDef.anonymous).toBe('boolean');
      });
    });

    it('should provide events with correct parameter types', () => {
      const abi = ContractFactory.getTestTokenABI();
      const transferEvent = abi.find(item => item.name === 'Transfer');

      expect(transferEvent?.inputs![0]!.type).toBe('address');
      expect(transferEvent?.inputs![1]!.type).toBe('address');
      expect(transferEvent?.inputs![2]!.type).toBe('uint256');
    });
  });
});