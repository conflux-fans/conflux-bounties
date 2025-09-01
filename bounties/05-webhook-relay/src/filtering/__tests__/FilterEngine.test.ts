// FilterEngine unit tests
import { FilterEngine } from '../FilterEngine';
import type { BlockchainEvent, EventFilters } from '../../types';

describe('FilterEngine', () => {
  let filterEngine: FilterEngine;
  let mockEvent: BlockchainEvent;

  beforeEach(() => {
    filterEngine = new FilterEngine();
    mockEvent = {
      contractAddress: '0x1234567890123456789012345678901234567890',
      eventName: 'Transfer',
      blockNumber: 12345,
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      logIndex: 0,
      args: {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        amount: '1000000000000000000', // 1 ETH in wei
        tokenId: 123,
        metadata: {
          name: 'Test Token',
          description: 'A test token'
        }
      },
      timestamp: new Date('2023-01-01T00:00:00Z')
    };
  });

  describe('evaluateFilters', () => {
    it('should return true for empty filters', () => {
      const result = filterEngine.evaluateFilters(mockEvent, {});
      expect(result).toBe(true);
    });

    it('should return true for null/undefined filters', () => {
      expect(filterEngine.evaluateFilters(mockEvent, null as any)).toBe(true);
      expect(filterEngine.evaluateFilters(mockEvent, undefined as any)).toBe(true);
    });

    it('should handle simple string equality filters', () => {
      const filters: EventFilters = {
        eventName: 'Transfer'
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        eventName: 'Approval'
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle simple number equality filters', () => {
      const filters: EventFilters = {
        blockNumber: 12345
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        blockNumber: 54321
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle array filters (implicit in operation)', () => {
      const filters: EventFilters = {
        eventName: ['Transfer', 'Approval']
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        eventName: ['Approval', 'Mint']
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle multiple filters (AND logic)', () => {
      const filters: EventFilters = {
        eventName: 'Transfer',
        blockNumber: 12345
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        eventName: 'Transfer',
        blockNumber: 54321
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle args filters', () => {
      const filters: EventFilters = {
        from: '0x1111111111111111111111111111111111111111'
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        from: '0x3333333333333333333333333333333333333333'
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle args. prefixed filters', () => {
      const filters: EventFilters = {
        'args.from': '0x1111111111111111111111111111111111111111'
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);
    });

    it('should handle nested args filters', () => {
      const filters: EventFilters = {
        'args.metadata.name': 'Test Token'
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        'args.metadata.name': 'Other Token'
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });
  });

  describe('filter expressions', () => {
    it('should handle eq operator', () => {
      const filters: EventFilters = {
        eventName: { operator: 'eq', value: 'Transfer' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        eventName: { operator: 'eq', value: 'Approval' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle ne operator', () => {
      const filters: EventFilters = {
        eventName: { operator: 'ne', value: 'Approval' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        eventName: { operator: 'ne', value: 'Transfer' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle gt operator with numbers', () => {
      const filters: EventFilters = {
        blockNumber: { operator: 'gt', value: 12000 }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        blockNumber: { operator: 'gt', value: 15000 }
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle lt operator with numbers', () => {
      const filters: EventFilters = {
        blockNumber: { operator: 'lt', value: 15000 }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        blockNumber: { operator: 'lt', value: 10000 }
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle gt/lt operators with strings', () => {
      const filters: EventFilters = {
        eventName: { operator: 'gt', value: 'Approval' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        eventName: { operator: 'lt', value: 'Approval' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle in operator', () => {
      const filters: EventFilters = {
        eventName: { operator: 'in', value: ['Transfer', 'Approval'] }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        eventName: { operator: 'in', value: ['Approval', 'Mint'] }
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle contains operator with strings', () => {
      const filters: EventFilters = {
        'args.metadata.name': { operator: 'contains', value: 'Test' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);

      const failingFilters: EventFilters = {
        'args.metadata.name': { operator: 'contains', value: 'Other' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, failingFilters)).toBe(false);
    });

    it('should handle contains operator case-insensitively', () => {
      const filters: EventFilters = {
        'args.metadata.name': { operator: 'contains', value: 'test' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);
    });
  });

  describe('special value handling', () => {
    it('should handle Ethereum address comparison case-insensitively', () => {
      const filters: EventFilters = {
        contractAddress: '0x1234567890123456789012345678901234567890'.toUpperCase()
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(true);
      
      // Also test with args addresses
      const argsFilters: EventFilters = {
        from: '0x1111111111111111111111111111111111111111'.toUpperCase()
      };
      expect(filterEngine.evaluateFilters(mockEvent, argsFilters)).toBe(true);
    });

    it('should handle BigNumber-like values', () => {
      const mockBigNumber = {
        toString: () => '1000000000000000000',
        _isBigNumber: true
      };

      const eventWithBigNumber = {
        ...mockEvent,
        args: {
          ...mockEvent.args,
          amount: mockBigNumber
        }
      };

      const filters: EventFilters = {
        amount: '1000000000000000000'
      };
      expect(filterEngine.evaluateFilters(eventWithBigNumber, filters)).toBe(true);

      const gtFilters: EventFilters = {
        amount: { operator: 'gt', value: '500000000000000000' }
      };
      expect(filterEngine.evaluateFilters(eventWithBigNumber, gtFilters)).toBe(true);
    });

    it('should handle null and undefined values', () => {
      const eventWithNull = {
        ...mockEvent,
        args: {
          ...mockEvent.args,
          nullValue: null,
          undefinedValue: undefined
        }
      };

      const nullFilters: EventFilters = {
        nullValue: { operator: 'eq', value: null }
      };
      expect(filterEngine.evaluateFilters(eventWithNull, nullFilters)).toBe(true);

      const undefinedFilters: EventFilters = {
        undefinedValue: { operator: 'eq', value: undefined }
      };
      expect(filterEngine.evaluateFilters(eventWithNull, undefinedFilters)).toBe(true);
    });

    it('should handle array event values with contains operator', () => {
      const eventWithArray = {
        ...mockEvent,
        args: {
          ...mockEvent.args,
          tags: ['token', 'erc20', 'defi']
        }
      };

      const filters: EventFilters = {
        tags: { operator: 'contains', value: 'erc20' }
      };
      expect(filterEngine.evaluateFilters(eventWithArray, filters)).toBe(true);

      const failingFilters: EventFilters = {
        tags: { operator: 'contains', value: 'nft' }
      };
      expect(filterEngine.evaluateFilters(eventWithArray, failingFilters)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing event args gracefully', () => {
      const filters: EventFilters = {
        nonExistentField: 'value'
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(false);
    });

    it('should handle invalid filter expressions', () => {
      const filters: EventFilters = {
        eventName: { operator: 'invalid', value: 'Transfer' } as any
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(false);
    });

    it('should handle deeply nested missing values', () => {
      const filters: EventFilters = {
        'args.metadata.nonExistent.deep': 'value'
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(false);
    });

    it('should handle empty arrays in in operator', () => {
      const filters: EventFilters = {
        eventName: { operator: 'in', value: [] }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(false);
    });

    it('should handle invalid filter value types', () => {
      const filters: EventFilters = {
        eventName: { invalid: 'object' } as any
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(false);
    });

    it('should handle gt/lt operators with incomparable types', () => {
      const gtFilters: EventFilters = {
        eventName: { operator: 'gt', value: {} }
      };
      expect(filterEngine.evaluateFilters(mockEvent, gtFilters)).toBe(false);

      const ltFilters: EventFilters = {
        eventName: { operator: 'lt', value: {} }
      };
      expect(filterEngine.evaluateFilters(mockEvent, ltFilters)).toBe(false);
    });

    it('should handle lt operator with mixed incomparable types', () => {
      const eventWithMixedTypes = {
        ...mockEvent,
        args: {
          ...mockEvent.args,
          booleanField: true,
          objectField: { test: 'value' }
        }
      };

      const booleanLtFilters: EventFilters = {
        booleanField: { operator: 'lt', value: 'string' }
      };
      expect(filterEngine.evaluateFilters(eventWithMixedTypes, booleanLtFilters)).toBe(false);

      const objectLtFilters: EventFilters = {
        objectField: { operator: 'lt', value: 123 }
      };
      expect(filterEngine.evaluateFilters(eventWithMixedTypes, objectLtFilters)).toBe(false);
    });

    it('should handle lt operator with boolean values', () => {
      const eventWithBoolean = {
        ...mockEvent,
        args: {
          ...mockEvent.args,
          booleanValue: true
        }
      };

      const ltFilters: EventFilters = {
        booleanValue: { operator: 'lt', value: false }
      };
      expect(filterEngine.evaluateFilters(eventWithBoolean, ltFilters)).toBe(false);
    });

    it('should handle in operator with non-array value', () => {
      const filters: EventFilters = {
        eventName: { operator: 'in', value: 'not-an-array' }
      };
      expect(filterEngine.evaluateFilters(mockEvent, filters)).toBe(false);
    });

    it('should handle contains operator with incompatible types', () => {
      // eventName is a string, but we're testing the case where eventValue is not string or array
      const eventWithNumber = {
        ...mockEvent,
        args: {
          ...mockEvent.args,
          numericField: 123
        }
      };
      
      const numericFilters: EventFilters = {
        numericField: { operator: 'contains', value: '12' }
      };
      expect(filterEngine.evaluateFilters(eventWithNumber, numericFilters)).toBe(false);
    });
  });
});