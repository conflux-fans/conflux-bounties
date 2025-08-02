import { BlockchainEvent } from '../../src/types/events';

export class EventFactory {
  static createBlockchainEvent(overrides: Partial<BlockchainEvent> = {}): BlockchainEvent {
    return {
      contractAddress: '0x1234567890123456789012345678901234567890',
      eventName: 'Transfer',
      blockNumber: 12345,
      transactionHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      logIndex: 0,
      args: {
        from: '0x0000000000000000000000000000000000000000',
        to: '0x1111111111111111111111111111111111111111',
        value: '1000000000000000000'
      },
      timestamp: new Date('2024-01-01T00:00:00Z'),
      ...overrides
    };
  }

  static createTransferEvent(from: string, to: string, value: string): BlockchainEvent {
    return this.createBlockchainEvent({
      eventName: 'Transfer',
      args: { from, to, value }
    });
  }

  static createApprovalEvent(owner: string, spender: string, value: string): BlockchainEvent {
    return this.createBlockchainEvent({
      eventName: 'Approval',
      args: { owner, spender, value }
    });
  }

  static createCustomEvent(eventName: string, args: Record<string, any>): BlockchainEvent {
    return this.createBlockchainEvent({
      eventName,
      args
    });
  }

  static createBatchEvents(count: number, baseEvent?: Partial<BlockchainEvent>): BlockchainEvent[] {
    return Array.from({ length: count }, (_, index) => 
      this.createBlockchainEvent({
        ...baseEvent,
        blockNumber: (baseEvent?.blockNumber || 12345) + index,
        logIndex: index,
        transactionHash: `0x${index.toString(16).padStart(64, '0')}`
      })
    );
  }
}