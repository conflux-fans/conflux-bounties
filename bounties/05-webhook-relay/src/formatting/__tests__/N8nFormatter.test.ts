// Unit tests for N8nFormatter
import { N8nFormatter } from '../N8nFormatter';
import type { BlockchainEvent } from '../../types/events';
import type { N8nPayload } from '../interfaces';

describe('N8nFormatter', () => {
  let formatter: N8nFormatter;
  let mockEvent: BlockchainEvent;

  beforeEach(() => {
    formatter = new N8nFormatter();
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
    it('should set format to n8n', () => {
      expect(formatter.getFormat()).toBe('n8n');
    });
  });

  describe('formatPayload', () => {
    it('should format payload with eventData structure', () => {
      const result = formatter.formatPayload(mockEvent) as N8nPayload;

      expect(result).toHaveProperty('eventData');
      expect(result.eventData).toHaveProperty('name');
      expect(result.eventData).toHaveProperty('contractAddress');
      expect(result.eventData).toHaveProperty('blockNumber');
      expect(result.eventData).toHaveProperty('transactionHash');
      expect(result.eventData).toHaveProperty('logIndex');
      expect(result.eventData).toHaveProperty('timestamp');
      expect(result.eventData).toHaveProperty('parameters');
    });

    it('should populate eventData fields correctly', () => {
      const result = formatter.formatPayload(mockEvent) as N8nPayload;

      expect(result.eventData.name).toBe('Transfer');
      expect(result.eventData.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(result.eventData.blockNumber).toBe(12345);
      expect(result.eventData.transactionHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(result.eventData.logIndex).toBe(0);
      expect(result.eventData.timestamp).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should populate parameters with event arguments', () => {
      const result = formatter.formatPayload(mockEvent) as N8nPayload;

      expect(result.eventData.parameters['from']).toBe('0x1111111111111111111111111111111111111111');
      expect(result.eventData.parameters['to']).toBe('0x2222222222222222222222222222222222222222');
      expect(result.eventData.parameters['value']).toBe('1000000000000000000');
      expect(result.eventData.parameters['tokenId']).toBe(123);
    });

    it('should preserve nested structures in parameters', () => {
      const result = formatter.formatPayload(mockEvent) as N8nPayload;

      expect(result.eventData.parameters['metadata']).toEqual({
        name: 'Test Token',
        description: 'A test token'
      });
    });

    it('should handle empty arguments', () => {
      const eventWithoutArgs = {
        ...mockEvent,
        args: {}
      };

      const result = formatter.formatPayload(eventWithoutArgs) as N8nPayload;

      expect(result.eventData.name).toBe('Transfer');
      expect(result.eventData.parameters).toEqual({});
    });

    it('should handle complex nested parameter structures', () => {
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

      const result = formatter.formatPayload(complexEvent) as N8nPayload;

      expect(result.eventData.parameters['user'].profile.name).toBe('John Doe');
      expect(result.eventData.parameters['user'].profile.settings.notifications).toBe(true);
      expect(result.eventData.parameters['user'].profile.settings.theme).toBe('dark');
      expect(result.eventData.parameters['user'].balance).toBe('1000');
      expect(result.eventData.parameters['transaction'].type).toBe('transfer');
      expect(result.eventData.parameters['transaction'].amount).toBe(500);
      expect(result.eventData.parameters['transaction'].recipients).toEqual(['0x1111', '0x2222']);
    });

    it('should handle arrays in parameters', () => {
      const eventWithArrays = {
        ...mockEvent,
        args: {
          recipients: ['0x1111', '0x2222', '0x3333'],
          amounts: [100, 200, 300],
          flags: [true, false, true]
        }
      };

      const result = formatter.formatPayload(eventWithArrays) as N8nPayload;

      expect(result.eventData.parameters['recipients']).toEqual(['0x1111', '0x2222', '0x3333']);
      expect(result.eventData.parameters['amounts']).toEqual([100, 200, 300]);
      expect(result.eventData.parameters['flags']).toEqual([true, false, true]);
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

      const result = formatter.formatPayload(eventWithCamelCase) as N8nPayload;

      expect(result.eventData.parameters['fromAddress']).toBe('0x1111');
      expect(result.eventData.parameters['toAddress']).toBe('0x2222');
      expect(result.eventData.parameters['tokenAmount']).toBe('1000');
      expect(result.eventData.parameters['isApproved']).toBe(true);
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

      const result = formatter.formatPayload(eventWithNullValues) as N8nPayload;

      expect(result.eventData.parameters['nullValue']).toBeNull();
      expect(result.eventData.parameters['undefinedValue']).toBeUndefined();
      expect(result.eventData.parameters['emptyString']).toBe('');
      expect(result.eventData.parameters['zero']).toBe(0);
      expect(result.eventData.parameters['false']).toBe(false);
    });
  });

  describe('validateFormat', () => {
    it('should return true for n8n format', () => {
      expect(formatter.validateFormat()).toBe(true);
    });
  });
});