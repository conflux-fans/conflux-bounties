// Unit tests for GenericFormatter
import { GenericFormatter } from '../GenericFormatter';
import type { BlockchainEvent } from '../../types/events';
import type { GenericPayload } from '../interfaces';

describe('GenericFormatter', () => {
  let formatter: GenericFormatter;
  let mockEvent: BlockchainEvent;

  beforeEach(() => {
    formatter = new GenericFormatter();
    mockEvent = {
      contractAddress: '0x1234567890123456789012345678901234567890',
      eventName: 'Transfer',
      blockNumber: 12345,
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      logIndex: 0,
      args: {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000',
        tokenId: 123,
        metadata: {
          name: 'Test Token',
          description: 'A test token'
        }
      },
      timestamp: new Date('2023-01-01T12:00:00.000Z')
    };
  });

  describe('constructor', () => {
    it('should set format to generic', () => {
      expect(formatter.getFormat()).toBe('generic');
    });
  });

  describe('formatPayload', () => {
    it('should maintain original structure with minimal transformation', () => {
      const result = formatter.formatPayload(mockEvent) as GenericPayload;

      expect(result.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(result.eventName).toBe('Transfer');
      expect(result.blockNumber).toBe(12345);
      expect(result.transactionHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(result.logIndex).toBe(0);
      expect(result.timestamp).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should preserve event arguments structure', () => {
      const result = formatter.formatPayload(mockEvent) as GenericPayload;

      expect(result.args['from']).toBe('0x1111111111111111111111111111111111111111');
      expect(result.args['to']).toBe('0x2222222222222222222222222222222222222222');
      expect(result.args['value']).toBe('1000000000000000000');
      expect(result.args['tokenId']).toBe(123);
    });

    it('should preserve nested structures in arguments', () => {
      const result = formatter.formatPayload(mockEvent) as GenericPayload;

      expect(result.args['metadata']).toEqual({
        name: 'Test Token',
        description: 'A test token'
      });
    });

    it('should handle empty arguments', () => {
      const eventWithoutArgs = {
        ...mockEvent,
        args: {}
      };

      const result = formatter.formatPayload(eventWithoutArgs) as GenericPayload;

      expect(result.eventName).toBe('Transfer');
      expect(result.args).toEqual({});
    });

    it('should handle complex nested argument structures', () => {
      const complexEvent = {
        ...mockEvent,
        args: {
          user: {
            profile: {
              name: 'John Doe',
              settings: {
                notifications: true,
                theme: 'dark'
              }
            },
            balance: '1000'
          },
          transaction: {
            type: 'transfer',
            amount: 500,
            recipients: ['0x1111', '0x2222']
          }
        }
      };

      const result = formatter.formatPayload(complexEvent) as GenericPayload;

      expect(result.args['user'].profile.name).toBe('John Doe');
      expect(result.args['user'].profile.settings.notifications).toBe(true);
      expect(result.args['user'].profile.settings.theme).toBe('dark');
      expect(result.args['user'].balance).toBe('1000');
      expect(result.args['transaction'].type).toBe('transfer');
      expect(result.args['transaction'].amount).toBe(500);
      expect(result.args['transaction'].recipients).toEqual(['0x1111', '0x2222']);
    });

    it('should handle arrays in arguments', () => {
      const eventWithArrays = {
        ...mockEvent,
        args: {
          recipients: ['0x1111', '0x2222', '0x3333'],
          amounts: [100, 200, 300],
          flags: [true, false, true]
        }
      };

      const result = formatter.formatPayload(eventWithArrays) as GenericPayload;

      expect(result.args['recipients']).toEqual(['0x1111', '0x2222', '0x3333']);
      expect(result.args['amounts']).toEqual([100, 200, 300]);
      expect(result.args['flags']).toEqual([true, false, true]);
    });

    it('should maintain camelCase field names', () => {
      const eventWithCamelCase = {
        ...mockEvent,
        args: {
          fromAddress: '0x1111',
          toAddress: '0x2222',
          tokenAmount: '1000',
          isApproved: true
        }
      };

      const result = formatter.formatPayload(eventWithCamelCase) as GenericPayload;

      expect(result.args['fromAddress']).toBe('0x1111');
      expect(result.args['toAddress']).toBe('0x2222');
      expect(result.args['tokenAmount']).toBe('1000');
      expect(result.args['isApproved']).toBe(true);
    });

    it('should handle null and undefined values', () => {
      const eventWithNullValues = {
        ...mockEvent,
        args: {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zero: 0,
          false: false
        }
      };

      const result = formatter.formatPayload(eventWithNullValues) as GenericPayload;

      expect(result.args['nullValue']).toBeNull();
      expect(result.args['undefinedValue']).toBeUndefined();
      expect(result.args['emptyString']).toBe('');
      expect(result.args['zero']).toBe(0);
      expect(result.args['false']).toBe(false);
    });

    it('should create a copy of arguments object', () => {
      const result = formatter.formatPayload(mockEvent) as GenericPayload;

      // Modify the result to ensure it's a copy
      result.args['newField'] = 'test';
      
      expect(mockEvent.args).not.toHaveProperty('newField');
    });

    it('should format timestamp as ISO string', () => {
      const result = formatter.formatPayload(mockEvent) as GenericPayload;

      expect(result.timestamp).toBe('2023-01-01T12:00:00.000Z');
      expect(typeof result.timestamp).toBe('string');
    });

    it('should handle string timestamp', () => {
      const eventWithStringTimestamp = {
        ...mockEvent,
        timestamp: '2023-01-01T12:00:00.000Z' as any
      };

      const result = formatter.formatPayload(eventWithStringTimestamp) as GenericPayload;

      expect(result.timestamp).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should handle numeric timestamp', () => {
      const eventWithNumericTimestamp = {
        ...mockEvent,
        timestamp: 1672574400000 as any // 2023-01-01T12:00:00.000Z
      };

      const result = formatter.formatPayload(eventWithNumericTimestamp) as GenericPayload;

      expect(result.timestamp).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should fallback to current time for invalid timestamp', () => {
      const eventWithInvalidTimestamp = {
        ...mockEvent,
        timestamp: null as any
      };

      const beforeTest = new Date();
      const result = formatter.formatPayload(eventWithInvalidTimestamp) as GenericPayload;
      const afterTest = new Date();

      const resultDate = new Date(result.timestamp);
      expect(resultDate.getTime()).toBeGreaterThanOrEqual(beforeTest.getTime());
      expect(resultDate.getTime()).toBeLessThanOrEqual(afterTest.getTime());
    });
  });

  describe('validateFormat', () => {
    it('should return true for generic format', () => {
      expect(formatter.validateFormat()).toBe(true);
    });
  });
});