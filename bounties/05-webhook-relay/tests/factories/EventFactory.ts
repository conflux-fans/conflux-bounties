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

  static createTransferEvent(params: { from?: string; to?: string; value?: string; contractAddress?: string; blockNumber?: number; transactionHash?: string; logIndex?: number } = {}): BlockchainEvent {
    const baseEvent: Partial<BlockchainEvent> = {
      eventName: 'Transfer',
      args: { 
        from: params.from || '0x0000000000000000000000000000000000000000',
        to: params.to || '0x1111111111111111111111111111111111111111',
        value: params.value || '1000000000000000000'
      }
    };

    // Only add properties if they are defined
    if (params.contractAddress !== undefined) {
      baseEvent.contractAddress = params.contractAddress;
    }
    if (params.blockNumber !== undefined) {
      baseEvent.blockNumber = params.blockNumber;
    }
    if (params.transactionHash !== undefined) {
      baseEvent.transactionHash = params.transactionHash;
    }
    if (params.logIndex !== undefined) {
      baseEvent.logIndex = params.logIndex;
    }

    return this.createBlockchainEvent(baseEvent);
  }

  // Keep the old method for backward compatibility
  static createTransferEventLegacy(from: string, to: string, value: string): BlockchainEvent {
    return this.createBlockchainEvent({
      eventName: 'Transfer',
      args: { from, to, value }
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