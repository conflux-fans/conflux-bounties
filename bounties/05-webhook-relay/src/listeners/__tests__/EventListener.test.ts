import { EventListener } from '../EventListener';
import { BlockchainConnection } from '../BlockchainConnection';
import { NetworkConfig } from '../../types/config';
import { EventSubscription } from '../../types';
import { ethers } from 'ethers';

// Mock BlockchainConnection
jest.mock('../BlockchainConnection');

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    Contract: jest.fn(),
    EventLog: jest.fn()
  }
}));

const MockedBlockchainConnection = BlockchainConnection as jest.MockedClass<typeof BlockchainConnection>;
const MockedContract = ethers.Contract as jest.MockedClass<typeof ethers.Contract>;

describe('EventListener', () => {
  let eventListener: EventListener;
  let mockConnection: jest.Mocked<BlockchainConnection>;
  let mockContract: any;
  let networkConfig: NetworkConfig;
  let testSubscription: EventSubscription;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock contract
    mockContract = {
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      address: '0x1234567890123456789012345678901234567890'
    };

    // Mock ethers.Contract
    MockedContract.mockImplementation(() => mockContract);

    // Create mock connection
    mockConnection = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      getProvider: jest.fn().mockReturnValue({}),
      on: jest.fn(),
      emit: jest.fn(),
      onEvent: jest.fn()
    } as any;

    MockedBlockchainConnection.mockImplementation(() => mockConnection);

    networkConfig = {
      rpcUrl: 'https://evm.confluxrpc.com',
      wsUrl: 'wss://evm.confluxrpc.com/ws',
      chainId: 1030,
      confirmations: 1
    };

    testSubscription = {
      id: 'test-subscription-1',
      contractAddress: '0x1234567890123456789012345678901234567890',
      eventSignature: 'Transfer(address indexed from, address indexed to, uint256 value)',
      filters: {},
      webhooks: []
    };

    eventListener = new EventListener(networkConfig);
  });

  describe('constructor', () => {
    it('should create instance with network config', () => {
      expect(eventListener).toBeInstanceOf(EventListener);
      expect(MockedBlockchainConnection).toHaveBeenCalledWith(networkConfig);
    });

    it('should setup connection event handlers', () => {
      expect(mockConnection.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockConnection.on).toHaveBeenCalledWith('maxReconnectAttemptsReached', expect.any(Function));
    });
  });

  describe('start', () => {
    it('should start successfully', async () => {
      const startedSpy = jest.fn();
      eventListener.on('started', startedSpy);

      await eventListener.start();

      expect(mockConnection.connect).toHaveBeenCalled();
      expect(eventListener.isListening()).toBe(true);
      expect(startedSpy).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await eventListener.start();
      mockConnection.connect.mockClear();

      await eventListener.start();

      expect(mockConnection.connect).not.toHaveBeenCalled();
    });

    it('should start existing subscriptions after connection', async () => {
      eventListener.addSubscription(testSubscription);
      
      await eventListener.start();

      expect(MockedContract).toHaveBeenCalledWith(
        testSubscription.contractAddress,
        [testSubscription.eventSignature],
        {}
      );
      expect(mockContract.on).toHaveBeenCalledWith('Transfer', expect.any(Function));
    });

    it('should emit error on connection failure', async () => {
      const testError = new Error('Connection failed');
      mockConnection.connect.mockRejectedValue(testError);

      const errorSpy = jest.fn();
      eventListener.on('error', errorSpy);

      await expect(eventListener.start()).rejects.toThrow('Connection failed');
      expect(errorSpy).toHaveBeenCalledWith(testError);
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      await eventListener.start();
    });

    it('should stop successfully', async () => {
      const stoppedSpy = jest.fn();
      eventListener.on('stopped', stoppedSpy);

      await eventListener.stop();

      expect(mockConnection.disconnect).toHaveBeenCalled();
      expect(eventListener.isListening()).toBe(false);
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it('should not stop if not running', async () => {
      await eventListener.stop();
      mockConnection.disconnect.mockClear();

      await eventListener.stop();

      expect(mockConnection.disconnect).not.toHaveBeenCalled();
    });

    it('should stop all subscriptions', async () => {
      eventListener.addSubscription(testSubscription);
      
      await eventListener.stop();

      expect(mockContract.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('addSubscription', () => {
    it('should add subscription when not running', () => {
      eventListener.addSubscription(testSubscription);

      const subscriptions = eventListener.getSubscriptions();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]).toEqual(testSubscription);
    });

    it('should add subscription and start monitoring when running', async () => {
      await eventListener.start();
      
      eventListener.addSubscription(testSubscription);

      expect(MockedContract).toHaveBeenCalledWith(
        testSubscription.contractAddress,
        [testSubscription.eventSignature],
        {}
      );
      expect(mockContract.on).toHaveBeenCalledWith('Transfer', expect.any(Function));
    });

    it('should handle subscription start failure gracefully', async () => {
      await eventListener.start();
      mockConnection.getProvider.mockReturnValue(null);

      const subscriptionErrorSpy = jest.fn();
      eventListener.on('subscriptionError', subscriptionErrorSpy);

      eventListener.addSubscription(testSubscription);

      expect(subscriptionErrorSpy).toHaveBeenCalledWith(
        testSubscription.id,
        expect.any(Error)
      );
    });
  });

  describe('removeSubscription', () => {
    beforeEach(async () => {
      await eventListener.start();
      eventListener.addSubscription(testSubscription);
    });

    it('should remove existing subscription', () => {
      eventListener.removeSubscription(testSubscription.id);

      const subscriptions = eventListener.getSubscriptions();
      expect(subscriptions).toHaveLength(0);
      expect(mockContract.removeAllListeners).toHaveBeenCalled();
    });

    it('should handle removal of non-existent subscription', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      eventListener.removeSubscription('non-existent-id');

      expect(consoleSpy).toHaveBeenCalledWith('Subscription non-existent-id not found');
      consoleSpy.mockRestore();
    });

    it('should handle errors when stopping subscription', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const testError = new Error('Failed to remove listeners');
      
      // Mock removeAllListeners to throw an error
      mockContract.removeAllListeners.mockImplementation(() => {
        throw testError;
      });

      eventListener.removeSubscription(testSubscription.id);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Error stopping subscription ${testSubscription.id}:`,
        testError
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await eventListener.start();
      eventListener.addSubscription(testSubscription);
    });

    it('should handle contract events correctly', () => {
      const eventSpy = jest.fn();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      eventListener.on('event', eventSpy);

      // Simulate contract event
      const mockEventLog = {
        address: testSubscription.contractAddress,
        eventName: 'Transfer',
        blockNumber: 12345,
        transactionHash: '0xabcdef',
        index: 0
      };

      const eventArgs = [
        '0x1111111111111111111111111111111111111111', // from
        '0x2222222222222222222222222222222222222222', // to
        '1000000000000000000' // value
      ];

      // Get the event listener function
      const eventHandler = mockContract.on.mock.calls.find((call: any) => call[0] === 'Transfer')?.[1];
      expect(eventHandler).toBeDefined();

      // Call the event handler
      eventHandler(...eventArgs, mockEventLog);

      expect(eventSpy).toHaveBeenCalledWith(
        testSubscription,
        expect.objectContaining({
          contractAddress: testSubscription.contractAddress.toLowerCase(),
          eventName: 'Transfer',
          blockNumber: 12345,
          transactionHash: '0xabcdef',
          logIndex: 0,
          args: expect.objectContaining({
            '0': eventArgs[0],
            '1': eventArgs[1],
            '2': eventArgs[2]
          }),
          timestamp: expect.any(Date)
        })
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Event detected: Transfer from ${testSubscription.contractAddress.toLowerCase()}`
      );
      consoleLogSpy.mockRestore();
    });

    it('should handle contract events without eventName property', () => {
      const eventSpy = jest.fn();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      eventListener.on('event', eventSpy);

      // Simulate contract event without eventName property
      const mockEventLog = {
        address: testSubscription.contractAddress,
        // eventName is undefined to test the fallback
        blockNumber: 12345,
        transactionHash: '0xabcdef',
        index: 0
      };

      const eventArgs = ['0x123', '0x456', '1000'];

      // Get the event listener function
      const eventHandler = mockContract.on.mock.calls.find((call: any) => call[0] === 'Transfer')?.[1];
      expect(eventHandler).toBeDefined();

      // Call the event handler
      eventHandler(...eventArgs, mockEventLog);

      expect(eventSpy).toHaveBeenCalledWith(
        testSubscription,
        expect.objectContaining({
          eventName: 'Transfer', // Should use parsed name from signature
          contractAddress: testSubscription.contractAddress.toLowerCase()
        })
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Event detected: Transfer from ${testSubscription.contractAddress.toLowerCase()}`
      );
      consoleLogSpy.mockRestore();
    });

    it('should handle event processing errors', () => {
      const eventErrorSpy = jest.fn();
      eventListener.on('eventError', eventErrorSpy);

      // Get the event listener function
      const eventHandler = mockContract.on.mock.calls.find((call: any) => call[0] === 'Transfer')?.[1];
      
      // Call with invalid event data to trigger error
      eventHandler();

      expect(eventErrorSpy).toHaveBeenCalledWith(
        testSubscription.id,
        expect.any(Error)
      );
    });
  });

  describe('connection event handling', () => {
    it('should restart subscriptions on reconnection', async () => {
      await eventListener.start();
      eventListener.addSubscription(testSubscription);

      // Clear previous calls
      MockedContract.mockClear();
      mockContract.on.mockClear();

      // Simulate reconnection
      const connectedHandler = mockConnection.on.mock.calls.find((call: any) => call[0] === 'connected')?.[1];
      if (connectedHandler) await connectedHandler();

      expect(MockedContract).toHaveBeenCalledWith(
        testSubscription.contractAddress,
        [testSubscription.eventSignature],
        {}
      );
      expect(mockContract.on).toHaveBeenCalledWith('Transfer', expect.any(Function));
    });

    it('should stop subscriptions on disconnection', async () => {
      await eventListener.start();
      eventListener.addSubscription(testSubscription);

      // Simulate disconnection
      const disconnectedHandler = mockConnection.on.mock.calls.find((call: any) => call[0] === 'disconnected')?.[1];
      if (disconnectedHandler) disconnectedHandler();

      expect(mockContract.removeAllListeners).toHaveBeenCalled();
    });

    it('should emit error on connection error', () => {
      const errorSpy = jest.fn();
      eventListener.on('error', errorSpy);

      const testError = new Error('Connection error');
      const errorHandler = mockConnection.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      if (errorHandler) errorHandler(testError);

      expect(errorSpy).toHaveBeenCalledWith(testError);
    });

    it('should emit connectionFailed on max reconnect attempts', () => {
      const connectionFailedSpy = jest.fn();
      eventListener.on('connectionFailed', connectionFailedSpy);

      const maxAttemptsHandler = mockConnection.on.mock.calls.find(
        (call: any) => call[0] === 'maxReconnectAttemptsReached'
      )?.[1];
      if (maxAttemptsHandler) maxAttemptsHandler();

      expect(connectionFailedSpy).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    describe('parseEventName', () => {
      it('should parse event name from signature', () => {
        // Access private method through any cast for testing
        const parseEventName = (eventListener as any).parseEventName;
        
        expect(parseEventName('Transfer(address,address,uint256)')).toBe('Transfer');
        expect(parseEventName('Approval(address,address,uint256)')).toBe('Approval');
        expect(parseEventName('CustomEvent(uint256,string)')).toBe('CustomEvent');
      });

      it('should handle malformed signatures', () => {
        const parseEventName = (eventListener as any).parseEventName;
        
        expect(parseEventName('InvalidSignature')).toBe('UnknownEvent');
        expect(parseEventName('')).toBe('UnknownEvent');
      });
    });

    describe('parseEventArgs', () => {
      it('should parse event arguments correctly', () => {
        const parseEventArgs = (eventListener as any).parseEventArgs;
        
        const args = ['0x123', '0x456', '1000'];
        const signature = 'Transfer(address from, address to, uint256 value)';
        
        const result = parseEventArgs(signature, args);
        
        expect(result).toEqual({
          '0': '0x123',
          '1': '0x456',
          '2': '1000',
          from: '0x123',
          to: '0x456',
          value: '1000'
        });
      });

      it('should handle signatures without parameter names', () => {
        const parseEventArgs = (eventListener as any).parseEventArgs;
        
        const args = ['0x123', '0x456'];
        const signature = 'Transfer(address,address)';
        
        const result = parseEventArgs(signature, args);
        
        expect(result).toEqual({
          '0': '0x123',
          '1': '0x456',
          param0: '0x123',
          param1: '0x456'
        });
      });

      it('should handle empty signatures', () => {
        const parseEventArgs = (eventListener as any).parseEventArgs;
        
        const args = ['value1', 'value2'];
        const signature = 'Event()';
        
        const result = parseEventArgs(signature, args);
        
        expect(result).toEqual({
          '0': 'value1',
          '1': 'value2'
        });
      });
    });
  });

  describe('isListening', () => {
    it('should return false when not started', () => {
      expect(eventListener.isListening()).toBe(false);
    });

    it('should return false when started but not connected', async () => {
      mockConnection.isConnected.mockReturnValue(false);
      await eventListener.start();

      expect(eventListener.isListening()).toBe(false);
    });

    it('should return true when started and connected', async () => {
      await eventListener.start();

      expect(eventListener.isListening()).toBe(true);
    });
  });

  describe('getSubscriptions', () => {
    it('should return empty array initially', () => {
      expect(eventListener.getSubscriptions()).toEqual([]);
    });

    it('should return all subscriptions', () => {
      const subscription2 = { ...testSubscription, id: 'test-subscription-2' };
      
      eventListener.addSubscription(testSubscription);
      eventListener.addSubscription(subscription2);

      const subscriptions = eventListener.getSubscriptions();
      expect(subscriptions).toHaveLength(2);
      expect(subscriptions).toContain(testSubscription);
      expect(subscriptions).toContain(subscription2);
    });
  });
});