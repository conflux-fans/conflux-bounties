import { EventFactory } from '../EventFactory';
import { BlockchainEvent } from '../../../src/types/events';

describe('EventFactory', () => {
  describe('createBlockchainEvent', () => {
    it('should create a default blockchain event', () => {
      const event = EventFactory.createBlockchainEvent();
      
      expect(event).toBeDefined();
      expect(event.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(event.eventName).toBe('Transfer');
      expect(event.blockNumber).toBe(12345);
      expect(event.transactionHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(event.logIndex).toBe(0);
      expect(event.timestamp).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('should create event with correct args structure', () => {
      const event = EventFactory.createBlockchainEvent();
      
      expect(event.args).toEqual({
        from: '0x0000000000000000000000000000000000000000',
        to: '0x1111111111111111111111111111111111111111',
        value: '1000000000000000000'
      });
    });

    it('should apply overrides correctly', () => {
      const overrides: Partial<BlockchainEvent> = {
        contractAddress: '0x9876543210987654321098765432109876543210',
        eventName: 'Approval',
        blockNumber: 54321,
        logIndex: 5
      };

      const event = EventFactory.createBlockchainEvent(overrides);
      
      expect(event.contractAddress).toBe(overrides.contractAddress);
      expect(event.eventName).toBe(overrides.eventName);
      expect(event.blockNumber).toBe(overrides.blockNumber);
      expect(event.logIndex).toBe(overrides.logIndex);
      // Non-overridden properties should remain default
      expect(event.transactionHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
    });

    it('should allow overriding args', () => {
      const customArgs = {
        owner: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        spender: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: '5000000000000000000'
      };

      const event = EventFactory.createBlockchainEvent({
        args: customArgs
      });

      expect(event.args).toEqual(customArgs);
    });

    it('should allow overriding timestamp', () => {
      const customTimestamp = new Date('2023-12-25T12:00:00Z');
      const event = EventFactory.createBlockchainEvent({
        timestamp: customTimestamp
      });

      expect(event.timestamp).toBe(customTimestamp);
    });

    it('should create valid Ethereum addresses', () => {
      const event = EventFactory.createBlockchainEvent();
      
      expect(event.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(event.args['from']).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(event.args['to']).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should create valid transaction hash', () => {
      const event = EventFactory.createBlockchainEvent();
      
      expect(event.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });
  });

  describe('createTransferEvent', () => {
    it('should create a Transfer event with specified addresses and value', () => {
      const from = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const to = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const value = '2500000000000000000';

      const event = EventFactory.createTransferEvent({ from, to, value });

      expect(event.eventName).toBe('Transfer');
      expect(event.args['from']).toBe(from);
      expect(event.args['to']).toBe(to);
      expect(event.args['value']).toBe(value);
    });

    it('should inherit default properties for Transfer event', () => {
      const event = EventFactory.createTransferEvent({
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: '1000000000000000000'
      });

      expect(event.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(event.blockNumber).toBe(12345);
      expect(event.transactionHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(event.logIndex).toBe(0);
      expect(event.timestamp).toEqual(new Date('2024-01-01T00:00:00Z'));
    });

    it('should handle zero address transfers', () => {
      const zeroAddress = '0x0000000000000000000000000000000000000000';
      const event = EventFactory.createTransferEvent({
        from: zeroAddress,
        to: '0x1111111111111111111111111111111111111111',
        value: '1000000000000000000'
      });

      expect(event.args['from']).toBe(zeroAddress);
      expect(event.eventName).toBe('Transfer');
    });

    it('should handle large value transfers', () => {
      const largeValue = '999999999999999999999999999999';
      const event = EventFactory.createTransferEvent({
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: largeValue
      });

      expect(event.args['value']).toBe(largeValue);
    });

    it('should handle custom contract address', () => {
      const customAddress = '0xcccccccccccccccccccccccccccccccccccccccc';
      const event = EventFactory.createTransferEvent({
        contractAddress: customAddress,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: '1000000000000000000'
      });

      expect(event.contractAddress).toBe(customAddress);
    });

    it('should handle custom block number', () => {
      const customBlockNumber = 99999;
      const event = EventFactory.createTransferEvent({
        blockNumber: customBlockNumber,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: '1000000000000000000'
      });

      expect(event.blockNumber).toBe(customBlockNumber);
    });

    it('should handle custom transaction hash', () => {
      const customTxHash = '0x1111111111111111111111111111111111111111111111111111111111111111';
      const event = EventFactory.createTransferEvent({
        transactionHash: customTxHash,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: '1000000000000000000'
      });

      expect(event.transactionHash).toBe(customTxHash);
    });

    it('should handle custom log index', () => {
      const customLogIndex = 42;
      const event = EventFactory.createTransferEvent({
        logIndex: customLogIndex,
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: '1000000000000000000'
      });

      expect(event.logIndex).toBe(customLogIndex);
    });

    it('should handle undefined parameters gracefully', () => {
      const event = EventFactory.createTransferEvent({});

      // Should use defaults when parameters are not provided
      expect(event.contractAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(event.blockNumber).toBe(12345);
      expect(event.transactionHash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890');
      expect(event.logIndex).toBe(0);
    });

    it('should support legacy createTransferEventLegacy method', () => {
      const from = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const to = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const value = '2500000000000000000';

      const event = (EventFactory as any).createTransferEventLegacy(from, to, value);

      expect(event.eventName).toBe('Transfer');
      expect(event.args['from']).toBe(from);
      expect(event.args['to']).toBe(to);
      expect(event.args['value']).toBe(value);
    });
  });

  describe('createBatchEvents', () => {
    it('should create specified number of events', () => {
      const count = 5;
      const events = EventFactory.createBatchEvents(count);

      expect(events).toHaveLength(count);
      events.forEach(event => {
        expect(event).toBeDefined();
        expect(event.eventName).toBe('Transfer');
      });
    });

    it('should create events with incremental block numbers', () => {
      const count = 3;
      const baseBlockNumber = 10000;
      const events = EventFactory.createBatchEvents(count, {
        blockNumber: baseBlockNumber
      });

      expect(events[0]!.blockNumber).toBe(baseBlockNumber);
      expect(events[1]!.blockNumber).toBe(baseBlockNumber + 1);
      expect(events[2]!.blockNumber).toBe(baseBlockNumber + 2);
    });

    it('should create events with incremental log indices', () => {
      const count = 4;
      const events = EventFactory.createBatchEvents(count);

      events.forEach((event, index) => {
        expect(event.logIndex).toBe(index);
      });
    });

    it('should create events with unique transaction hashes', () => {
      const count = 3;
      const events = EventFactory.createBatchEvents(count);

      const hashes = events.map(event => event.transactionHash);
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(count);
    });

    it('should apply base event properties to all events', () => {
      const count = 3;
      const baseEvent: Partial<BlockchainEvent> = {
        contractAddress: '0x9999999999999999999999999999999999999999',
        eventName: 'CustomEvent'
      };

      const events = EventFactory.createBatchEvents(count, baseEvent);

      events.forEach(event => {
        expect(event.contractAddress).toBe(baseEvent.contractAddress);
        expect(event.eventName).toBe(baseEvent.eventName);
      });
    });

    it('should handle zero count', () => {
      const events = EventFactory.createBatchEvents(0);
      expect(events).toHaveLength(0);
    });

    it('should handle large batch sizes', () => {
      const count = 100;
      const events = EventFactory.createBatchEvents(count);

      expect(events).toHaveLength(count);
      // Check first and last events
      expect(events[0]!.blockNumber).toBe(12345);
      expect(events[99]!.blockNumber).toBe(12345 + 99);
      expect(events[0]!.logIndex).toBe(0);
      expect(events[99]!.logIndex).toBe(99);
    });

    it('should create valid transaction hashes for all events', () => {
      const count = 5;
      const events = EventFactory.createBatchEvents(count);

      events.forEach(event => {
        expect(event.transactionHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
      });
    });

    it('should preserve timestamp when specified in base event', () => {
      const customTimestamp = new Date('2023-06-15T10:30:00Z');
      const events = EventFactory.createBatchEvents(2, {
        timestamp: customTimestamp
      });

      events.forEach(event => {
        expect(event.timestamp).toBe(customTimestamp);
      });
    });
  });

  describe('event validation', () => {
    it('should create events with consistent structure', () => {
      const event = EventFactory.createBlockchainEvent();

      expect(typeof event.contractAddress).toBe('string');
      expect(typeof event.eventName).toBe('string');
      expect(typeof event.blockNumber).toBe('number');
      expect(typeof event.transactionHash).toBe('string');
      expect(typeof event.logIndex).toBe('number');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(typeof event.args).toBe('object');
    });

    it('should create events with valid numeric values', () => {
      const event = EventFactory.createBlockchainEvent();

      expect(event.blockNumber).toBeGreaterThan(0);
      expect(event.logIndex).toBeGreaterThanOrEqual(0);
    });

    it('should create events with non-empty strings', () => {
      const event = EventFactory.createBlockchainEvent();

      expect(event.contractAddress.length).toBeGreaterThan(0);
      expect(event.eventName.length).toBeGreaterThan(0);
      expect(event.transactionHash.length).toBeGreaterThan(0);
    });
  });
});