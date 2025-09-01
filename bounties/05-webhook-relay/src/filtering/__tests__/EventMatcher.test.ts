// EventMatcher unit tests
import { EventMatcher } from '../EventMatcher';
import type { BlockchainEvent, EventFilters } from '../../types';
import type { IFilterEngine, IFilterValidator } from '../interfaces';

describe('EventMatcher', () => {
  let eventMatcher: EventMatcher;
  let mockFilterEngine: jest.Mocked<IFilterEngine>;
  let mockFilterValidator: jest.Mocked<IFilterValidator>;
  let validEvent: BlockchainEvent;

  beforeEach(() => {
    mockFilterEngine = {
      evaluateFilters: jest.fn()
    };

    mockFilterValidator = {
      validateFilters: jest.fn(),
      validateFilterExpression: jest.fn()
    };

    eventMatcher = new EventMatcher(mockFilterEngine, mockFilterValidator);

    validEvent = {
      contractAddress: '0x1234567890123456789012345678901234567890',
      eventName: 'Transfer',
      blockNumber: 12345,
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      logIndex: 0,
      args: {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        amount: '1000000000000000000'
      },
      timestamp: new Date('2023-01-01T00:00:00Z')
    };
  });

  describe('matchesSubscription', () => {
    it('should return false for invalid events', () => {
      const invalidEvents = [
        null,
        undefined,
        {},
        { contractAddress: 'invalid' },
        { ...validEvent, contractAddress: undefined },
        { ...validEvent, eventName: undefined },
        { ...validEvent, blockNumber: undefined },
        { ...validEvent, transactionHash: undefined },
        { ...validEvent, logIndex: undefined },
        { ...validEvent, args: undefined },
        { ...validEvent, timestamp: undefined }
      ];

      const filters: EventFilters = { eventName: 'Transfer' };

      invalidEvents.forEach(event => {
        const result = eventMatcher.matchesSubscription(event as any, filters);
        expect(result).toBe(false);
      });

      // Ensure mocks weren't called for invalid events
      expect(mockFilterValidator.validateFilters).not.toHaveBeenCalled();
      expect(mockFilterEngine.evaluateFilters).not.toHaveBeenCalled();
    });

    it('should validate event field types', () => {
      const invalidTypeEvents = [
        { ...validEvent, contractAddress: 123 },
        { ...validEvent, eventName: 123 },
        { ...validEvent, blockNumber: 'invalid' },
        { ...validEvent, transactionHash: 123 },
        { ...validEvent, logIndex: 'invalid' },
        { ...validEvent, args: 'invalid' },
        { ...validEvent, timestamp: 'invalid' }
      ];

      const filters: EventFilters = { eventName: 'Transfer' };

      invalidTypeEvents.forEach(event => {
        const result = eventMatcher.matchesSubscription(event as any, filters);
        expect(result).toBe(false);
      });
    });

    it('should validate Ethereum address format', () => {
      const invalidAddresses = [
        '0x123', // too short
        '0x12345678901234567890123456789012345678901', // too long
        '1234567890123456789012345678901234567890', // missing 0x
        '0xGGGG567890123456789012345678901234567890', // invalid hex
        ''
      ];

      const filters: EventFilters = { eventName: 'Transfer' };

      invalidAddresses.forEach(address => {
        const event = { ...validEvent, contractAddress: address };
        const result = eventMatcher.matchesSubscription(event, filters);
        expect(result).toBe(false);
      });
    });

    it('should validate transaction hash format', () => {
      const invalidHashes = [
        '0x123', // too short
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678901', // too long
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', // missing 0x
        '0xGGGGef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', // invalid hex
        ''
      ];

      const filters: EventFilters = { eventName: 'Transfer' };

      invalidHashes.forEach(hash => {
        const event = { ...validEvent, transactionHash: hash };
        const result = eventMatcher.matchesSubscription(event, filters);
        expect(result).toBe(false);
      });
    });

    it('should validate non-negative numbers', () => {
      const negativeBlockEvent = { ...validEvent, blockNumber: -1 };
      const negativeLogEvent = { ...validEvent, logIndex: -1 };
      const filters: EventFilters = { eventName: 'Transfer' };

      expect(eventMatcher.matchesSubscription(negativeBlockEvent, filters)).toBe(false);
      expect(eventMatcher.matchesSubscription(negativeLogEvent, filters)).toBe(false);
    });

    it('should return false when filter validation fails', () => {
      mockFilterValidator.validateFilters.mockReturnValue({
        isValid: false,
        errors: [{ field: 'test', message: 'Invalid filter' }]
      });

      const filters: EventFilters = { eventName: 'Transfer' };
      const result = eventMatcher.matchesSubscription(validEvent, filters);

      expect(result).toBe(false);
      expect(mockFilterValidator.validateFilters).toHaveBeenCalledWith(filters);
      expect(mockFilterEngine.evaluateFilters).not.toHaveBeenCalled();
    });

    it('should use filter engine when validation passes', () => {
      mockFilterValidator.validateFilters.mockReturnValue({
        isValid: true,
        errors: []
      });
      mockFilterEngine.evaluateFilters.mockReturnValue(true);

      const filters: EventFilters = { eventName: 'Transfer' };
      const result = eventMatcher.matchesSubscription(validEvent, filters);

      expect(result).toBe(true);
      expect(mockFilterValidator.validateFilters).toHaveBeenCalledWith(filters);
      expect(mockFilterEngine.evaluateFilters).toHaveBeenCalledWith(validEvent, filters);
    });

    it('should return filter engine result', () => {
      mockFilterValidator.validateFilters.mockReturnValue({
        isValid: true,
        errors: []
      });
      mockFilterEngine.evaluateFilters.mockReturnValue(false);

      const filters: EventFilters = { eventName: 'Transfer' };
      const result = eventMatcher.matchesSubscription(validEvent, filters);

      expect(result).toBe(false);
      expect(mockFilterEngine.evaluateFilters).toHaveBeenCalledWith(validEvent, filters);
    });

    it('should log validation errors', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockFilterValidator.validateFilters.mockReturnValue({
        isValid: false,
        errors: [{ field: 'test', message: 'Invalid filter' }]
      });

      const filters: EventFilters = { eventName: 'Transfer' };
      eventMatcher.matchesSubscription(validEvent, filters);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Invalid filters provided:',
        [{ field: 'test', message: 'Invalid filter' }]
      );

      consoleSpy.mockRestore();
    });
  });

  describe('integration with real implementations', () => {
    beforeEach(() => {
      // Use real implementations for integration tests
      eventMatcher = new EventMatcher();
    });

    it('should work with real filter engine and validator', () => {
      const filters: EventFilters = {
        eventName: 'Transfer',
        'args.from': '0x1111111111111111111111111111111111111111'
      };

      const result = eventMatcher.matchesSubscription(validEvent, filters);
      expect(result).toBe(true);
    });

    it('should reject events that dont match filters', () => {
      const filters: EventFilters = {
        eventName: 'Approval' // Different event name
      };

      const result = eventMatcher.matchesSubscription(validEvent, filters);
      expect(result).toBe(false);
    });

    it('should handle complex filter expressions', () => {
      const filters: EventFilters = {
        blockNumber: { operator: 'gt', value: 10000 },
        'args.amount': { operator: 'in', value: ['1000000000000000000', '2000000000000000000'] }
      };

      const result = eventMatcher.matchesSubscription(validEvent, filters);
      expect(result).toBe(true);
    });

    it('should reject invalid filters', () => {
      const filters: EventFilters = {
        invalidField: 'value',
        eventName: { operator: 'invalid', value: 'test' } as any
      };

      const result = eventMatcher.matchesSubscription(validEvent, filters);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle events with minimal valid structure', () => {
      const minimalEvent: BlockchainEvent = {
        contractAddress: '0x1234567890123456789012345678901234567890',
        eventName: 'Test',
        blockNumber: 0,
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        logIndex: 0,
        args: {},
        timestamp: new Date()
      };

      mockFilterValidator.validateFilters.mockReturnValue({
        isValid: true,
        errors: []
      });
      mockFilterEngine.evaluateFilters.mockReturnValue(true);

      const result = eventMatcher.matchesSubscription(minimalEvent, {});
      expect(result).toBe(true);
    });

    it('should handle events with complex args structure', () => {
      const complexEvent: BlockchainEvent = {
        ...validEvent,
        args: {
          user: {
            address: '0x1111111111111111111111111111111111111111',
            metadata: {
              name: 'Test User',
              tags: ['premium', 'verified']
            }
          },
          amounts: [100, 200, 300],
          flags: {
            isActive: true,
            hasPermission: false
          }
        }
      };

      mockFilterValidator.validateFilters.mockReturnValue({
        isValid: true,
        errors: []
      });
      mockFilterEngine.evaluateFilters.mockReturnValue(true);

      const filters: EventFilters = {
        'args.user.metadata.name': 'Test User'
      };

      const result = eventMatcher.matchesSubscription(complexEvent, filters);
      expect(result).toBe(true);
    });
  });
});