// Unit tests for MakeFormatter
import { MakeFormatter } from '../MakeFormatter';
import type { BlockchainEvent } from '../../types/events';
import type { MakePayload } from '../interfaces';

describe('MakeFormatter', () => {
  let formatter: MakeFormatter;
  let mockEvent: BlockchainEvent;

  beforeEach(() => {
    formatter = new MakeFormatter();
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
    it('should set format to make', () => {
      expect(formatter.getFormat()).toBe('make');
    });
  });

  describe('formatPayload', () => {
    it('should format payload with metadata and data sections', () => {
      const result = formatter.formatPayload(mockEvent) as MakePayload;

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('data');
    });

    it('should populate metadata section correctly', () => {
      const result = formatter.formatPayload(mockEvent) as MakePayload;

      expect(result.metadata.eventName).toBe('Transfer');
      expect(result.metadata.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(result.metadata.blockNumber).toBe(12345);
      expect(result.metadata.transactionHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(result.metadata.logIndex).toBe(0);
      expect(result.metadata.timestamp).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should populate data section with event arguments', () => {
      const result = formatter.formatPayload(mockEvent) as MakePayload;

      expect(result.data['from']).toBe('0x1111111111111111111111111111111111111111');
      expect(result.data['to']).toBe('0x2222222222222222222222222222222222222222');
      expect(result.data['value']).toBe('1000000000000000000');
      expect(result.data['tokenId']).toBe(123);
    });

    it('should preserve nested structures in data section', () => {
      const result = formatter.formatPayload(mockEvent) as MakePayload;

      expect(result.data['metadata']).toEqual({
        name: 'Test Token',
        description: 'A test token'
      });
    });

    it('should handle empty arguments', () => {
      const eventWithoutArgs = {
        ...mockEvent,
        args: {}
      };

      const result = formatter.formatPayload(eventWithoutArgs) as MakePayload;

      expect(result.metadata.eventName).toBe('Transfer');
      expect(result.data).toEqual({});
    });

    it('should handle complex nested data structures', () => {
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

      const result = formatter.formatPayload(complexEvent) as MakePayload;

      expect(result.data['user'].profile.name).toBe('John Doe');
      expect(result.data['user'].profile.settings.notifications).toBe(true);
      expect(result.data['user'].profile.settings.theme).toBe('dark');
      expect(result.data['user'].balance).toBe('1000');
      expect(result.data['transaction'].type).toBe('transfer');
      expect(result.data['transaction'].amount).toBe(500);
      expect(result.data['transaction'].recipients).toEqual(['0x1111', '0x2222']);
    });

    it('should handle arrays in data section', () => {
      const eventWithArrays = {
        ...mockEvent,
        args: {
          recipients: ['0x1111', '0x2222', '0x3333'],
          amounts: [100, 200, 300],
          flags: [true, false, true]
        }
      };

      const result = formatter.formatPayload(eventWithArrays) as MakePayload;

      expect(result.data['recipients']).toEqual(['0x1111', '0x2222', '0x3333']);
      expect(result.data['amounts']).toEqual([100, 200, 300]);
      expect(result.data['flags']).toEqual([true, false, true]);
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

      const result = formatter.formatPayload(eventWithCamelCase) as MakePayload;

      expect(result.data['fromAddress']).toBe('0x1111');
      expect(result.data['toAddress']).toBe('0x2222');
      expect(result.data['tokenAmount']).toBe('1000');
      expect(result.data['isApproved']).toBe(true);
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

      const result = formatter.formatPayload(eventWithNullValues) as MakePayload;

      expect(result.data['nullValue']).toBeNull();
      expect(result.data['undefinedValue']).toBeUndefined();
      expect(result.data['emptyString']).toBe('');
      expect(result.data['zero']).toBe(0);
      expect(result.data['false']).toBe(false);
    });
  });

  describe('validateFormat', () => {
    it('should return true for make format', () => {
      expect(formatter.validateFormat()).toBe(true);
    });
  });
});