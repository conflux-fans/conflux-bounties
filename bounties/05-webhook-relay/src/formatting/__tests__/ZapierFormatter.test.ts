// Unit tests for ZapierFormatter
import { ZapierFormatter } from '../ZapierFormatter';
import type { BlockchainEvent } from '../../types/events';
import type { ZapierPayload } from '../interfaces';

describe('ZapierFormatter', () => {
  let formatter: ZapierFormatter;
  let mockEvent: BlockchainEvent;

  beforeEach(() => {
    formatter = new ZapierFormatter();
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
    it('should set format to zapier', () => {
      expect(formatter.getFormat()).toBe('zapier');
    });
  });

  describe('formatPayload', () => {
    it('should format payload with snake_case field names', () => {
      const result = formatter.formatPayload(mockEvent) as ZapierPayload;

      expect(result.event_name).toBe('Transfer');
      expect(result.contract_address).toBe('0x1234567890123456789012345678901234567890');
      expect(result.block_number).toBe(12345);
      expect(result.transaction_hash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(result['log_index']).toBe(0);
      expect(result['timestamp']).toBe('2023-01-01T12:00:00.000Z');
    });

    it('should flatten and prefix event arguments', () => {
      const result = formatter.formatPayload(mockEvent) as ZapierPayload;

      expect(result['arg_from']).toBe('0x1111111111111111111111111111111111111111');
      expect(result['arg_to']).toBe('0x2222222222222222222222222222222222222222');
      expect(result['arg_value']).toBe('1000000000000000000');
      expect(result['arg_token_id']).toBe(123);
    });

    it('should flatten nested objects in arguments', () => {
      const result = formatter.formatPayload(mockEvent) as ZapierPayload;

      expect(result['arg_metadata_name']).toBe('Test Token');
      expect(result['arg_metadata_description']).toBe('A test token');
    });

    it('should handle empty arguments', () => {
      const eventWithoutArgs = {
        ...mockEvent,
        args: {}
      };

      const result = formatter.formatPayload(eventWithoutArgs) as ZapierPayload;

      expect(result.event_name).toBe('Transfer');
      expect(result.contract_address).toBe('0x1234567890123456789012345678901234567890');
      expect(Object.keys(result).filter(key => key.startsWith('arg_'))).toHaveLength(0);
    });

    it('should handle complex nested structures', () => {
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
            amount: 500
          }
        }
      };

      const result = formatter.formatPayload(complexEvent) as ZapierPayload;

      expect(result['arg_user_profile_name']).toBe('John Doe');
      expect(result['arg_user_profile_settings_notifications']).toBe(true);
      expect(result['arg_user_profile_settings_theme']).toBe('dark');
      expect(result['arg_user_balance']).toBe('1000');
      expect(result['arg_transaction_type']).toBe('transfer');
      expect(result['arg_transaction_amount']).toBe(500);
    });

    it('should handle arrays without flattening them', () => {
      const eventWithArrays = {
        ...mockEvent,
        args: {
          recipients: ['0x1111', '0x2222', '0x3333'],
          amounts: [100, 200, 300]
        }
      };

      const result = formatter.formatPayload(eventWithArrays) as ZapierPayload;

      expect(result['arg_recipients']).toEqual(['0x1111', '0x2222', '0x3333']);
      expect(result['arg_amounts']).toEqual([100, 200, 300]);
    });

    it('should convert camelCase argument names to snake_case', () => {
      const eventWithCamelCase = {
        ...mockEvent,
        args: {
          fromAddress: '0x1111',
          toAddress: '0x2222',
          tokenAmount: '1000',
          isApproved: true
        }
      };

      const result = formatter.formatPayload(eventWithCamelCase) as ZapierPayload;

      expect(result['arg_from_address']).toBe('0x1111');
      expect(result['arg_to_address']).toBe('0x2222');
      expect(result['arg_token_amount']).toBe('1000');
      expect(result['arg_is_approved']).toBe(true);
    });
  });

  describe('validateFormat', () => {
    it('should return true for zapier format', () => {
      expect(formatter.validateFormat()).toBe(true);
    });
  });
});