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
    EventLog: jest.fn(),
    formatEther: jest.fn().mockReturnValue('1.0')
  }
}));

// Mock fs to prevent config.json reading errors
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('{"subscriptions": []}')
}));

// Mock fetch for webhook testing
global.fetch = jest.fn();

const MockedBlockchainConnection = BlockchainConnection as jest.MockedClass<typeof BlockchainConnection>;
const MockedContract = ethers.Contract as jest.MockedClass<typeof ethers.Contract>;

// Helper function to get contract address as string
const getContractAddress = (contractAddress: string | string[]): string => {
  return Array.isArray(contractAddress) ? contractAddress[0] || '' : contractAddress || '';
};

describe('EventListener', () => {
  let eventListener: EventListener;
  let mockConnection: jest.Mocked<BlockchainConnection>;
  let mockContract: any;
  let networkConfig: NetworkConfig;
  let testSubscription: EventSubscription;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock contract instance
    mockContract = {
      on: jest.fn(),
      off: jest.fn(),
      removeAllListeners: jest.fn(),
      address: '0x' + Math.floor(Math.random() * 1e40).toString(16).padStart(40, '0')
    };

    // Mock ethers.Contract to return the mock contract instance
    MockedContract.mockImplementation(() => mockContract);

    // Create mock provider
    const mockProvider = {
      on: jest.fn(),
      getBlock: jest.fn(),
      getTransaction: jest.fn()
    };

    // Create mock connection
    mockConnection = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      isConnected: jest.fn().mockReturnValue(true),
      getProvider: jest.fn().mockReturnValue(mockProvider),
      on: jest.fn(),
      emit: jest.fn(),
      onEvent: jest.fn(),
      enableBlockMonitoring: jest.fn(),
      disableBlockMonitoring: jest.fn(),
      addContractToMonitor: jest.fn(),
      removeContractFromMonitor: jest.fn(),
      getConnectionStatus: jest.fn().mockReturnValue({
        status: 'connected',
        blockCount: 100,
        transactionCount: 50,
        monitoredContracts: 2
      })
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

      // The EventListener creates an ABI with event signatures prefixed with "event"
      expect(MockedContract).toHaveBeenCalledWith(
        testSubscription.contractAddress,
        expect.arrayContaining([
          'event Transfer(address indexed from, address indexed to, uint256 value)'
        ]),
        expect.any(Object)
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

      expect(mockContract.off).toHaveBeenCalled();
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

      // The EventListener creates an ABI with event signatures prefixed with "event"
      expect(MockedContract).toHaveBeenCalledWith(
        testSubscription.contractAddress,
        expect.arrayContaining([
          'event Transfer(address indexed from, address indexed to, uint256 value)'
        ]),
        expect.any(Object)
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
      expect(mockContract.off).toHaveBeenCalled();
    });

    it('should handle removal of non-existent subscription', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      eventListener.removeSubscription('non-existent-id');

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Subscription non-existent-id not found'));
      consoleSpy.mockRestore();
    });

    it('should handle errors when stopping subscription', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const testError = new Error('Failed to remove listeners');
      
      // Mock off to throw an error
      mockContract.off.mockImplementation(() => {
        throw testError;
      });

      eventListener.removeSubscription(testSubscription.id);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Error stopping subscription ${testSubscription.id}:`),
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

    it('should handle contract events correctly', async () => {
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

      // Create a proper event object with fragment property
      const mockEvent = {
        ...mockEventLog,
        fragment: { name: 'Transfer' },
        log: mockEventLog
      };

      // Call the event handler
      await eventHandler(...eventArgs, mockEvent);

      expect(eventSpy).toHaveBeenCalledWith(
        testSubscription,
        expect.objectContaining({
          contractAddress: getContractAddress(testSubscription.contractAddress).toLowerCase(),
          eventName: 'Transfer',
          blockNumber: 12345,
          transactionHash: '0xabcdef',
          logIndex: 0,
          args: expect.objectContaining({
            arg0: eventArgs[0],
            arg1: eventArgs[1],
            arg2: eventArgs[2]
          }),
          timestamp: expect.any(Date)
        })
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Contract EVENT #')
      );
      consoleLogSpy.mockRestore();
    });

    it('should handle contract events without eventName property', async () => {
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

      // Create a proper event object with fragment property
      const mockEvent = {
        ...mockEventLog,
        fragment: { name: 'Transfer' },
        log: mockEventLog
      };

      // Call the event handler
      await eventHandler(...eventArgs, mockEvent);

      expect(eventSpy).toHaveBeenCalledWith(
        testSubscription,
        expect.objectContaining({
          eventName: 'Transfer', // Should use parsed name from signature
          contractAddress: getContractAddress(testSubscription.contractAddress).toLowerCase()
        })
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 Contract EVENT #')
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
        expect.arrayContaining([
          'event Transfer(address indexed from, address indexed to, uint256 value)'
        ]),
        expect.any(Object)
      );
      expect(mockContract.on).toHaveBeenCalledWith('Transfer', expect.any(Function));
    });

    it('should stop subscriptions on disconnection', async () => {
      await eventListener.start();
      eventListener.addSubscription(testSubscription);

      // Simulate disconnection
      const disconnectedHandler = mockConnection.on.mock.calls.find((call: any) => call[0] === 'disconnected')?.[1];
      if (disconnectedHandler) disconnectedHandler();

      expect(mockContract.off).toHaveBeenCalled();
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

    describe('parseEventArgsEnhanced', () => {
      it('should parse event arguments correctly', () => {
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

  describe('configuration loading', () => {
    const fs = require('fs');

    it('should load subscriptions from config.json', async () => {
      const configData = {
        subscriptions: [{
          id: 'config-subscription',
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventSignature: 'Transfer(address indexed from, address indexed to, uint256 value)',
          filters: {},
          webhooks: [{ 
            id: 'webhook1', 
            url: 'https://example.com/webhook',
            format: 'generic' as const,
            headers: {},
            timeout: 5000,
            retryAttempts: 3
          }]
        }]
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(configData));
      
      await eventListener.start();
      
      const subscriptions = eventListener.getSubscriptions();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]?.id).toBe('config-subscription');
    });

    it('should handle invalid config.json gracefully', async () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await eventListener.start();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error loading configuration:'),
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed JSON in config.json', async () => {
      fs.readFileSync.mockReturnValue('invalid json');
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await eventListener.start();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error loading configuration:'),
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle config without subscriptions', async () => {
      fs.readFileSync.mockReturnValue('{}');
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await eventListener.start();
      
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      
      consoleWarnSpy.mockRestore();
    });

    it('should skip invalid subscription configurations', async () => {
      const configData = {
        subscriptions: [
          { id: 'invalid-sub' }, // Missing required fields
          {
            id: 'valid-subscription',
            contractAddress: '0x1234567890123456789012345678901234567890',
            webhooks: [{ 
              id: 'webhook1', 
              url: 'https://example.com/webhook',
              format: 'generic' as const,
              headers: {},
              timeout: 5000,
              retryAttempts: 3
            }]
          }
        ]
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(configData));
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      await eventListener.start();
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid subscription configuration:'),
        expect.objectContaining({ id: 'invalid-sub' })
      );
      
      const subscriptions = eventListener.getSubscriptions();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]?.id).toBe('valid-subscription');
      
      consoleWarnSpy.mockRestore();
    });

    it('should not duplicate existing subscriptions from config', async () => {
      eventListener.addSubscription(testSubscription);
      
      const configData = {
        subscriptions: [{
          id: testSubscription.id, // Same ID as existing subscription
          contractAddress: '0x9999999999999999999999999999999999999999',
          webhooks: [{ 
            id: 'webhook1', 
            url: 'https://example.com/webhook',
            format: 'generic' as const,
            headers: {},
            timeout: 5000,
            retryAttempts: 3
          }]
        }]
      };
      
      fs.readFileSync.mockReturnValue(JSON.stringify(configData));
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await eventListener.start();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('already exists, skipping config version')
      );
      
      const subscriptions = eventListener.getSubscriptions();
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]?.contractAddress).toBe(testSubscription.contractAddress); // Original subscription preserved
      
      consoleLogSpy.mockRestore();
    });
  });



  describe('event statistics and monitoring', () => {
    beforeEach(async () => {
      await eventListener.start();
      eventListener.addSubscription(testSubscription);
    });

    it('should track event statistics', async () => {
      // Trigger an event
      const eventHandler = mockContract.on.mock.calls.find((call: any) => call[0] === 'Transfer')?.[1];
      const mockEvent = {
        fragment: { name: 'Transfer' },
        log: {
          address: testSubscription.contractAddress,
          blockNumber: 12345,
          transactionHash: '0xabcdef',
          index: 0
        }
      };
      
      await eventHandler('0x123', '0x456', '1000', mockEvent);
      
      const stats = eventListener.getEventStatistics();
      expect(stats.totalEvents).toBe(1);
      expect(stats.eventsByType).toHaveProperty('Transfer', 1);
      const contractAddress = Array.isArray(testSubscription.contractAddress) 
        ? testSubscription.contractAddress[0] 
        : testSubscription.contractAddress;
      expect(stats.eventsByContract).toHaveProperty(contractAddress?.toLowerCase() || '', 1);
      expect(stats.lastEventTime).toBeInstanceOf(Date);
    });

    it('should display event status', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      eventListener.displayEventStatus();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('📊 Event Listener Status:')
      );
      
      consoleLogSpy.mockRestore();
    });
  });

  describe('error handling edge cases', () => {
    it('should handle event processing errors gracefully', async () => {
      await eventListener.start();
      eventListener.addSubscription(testSubscription);
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Get the event handler
      const eventHandler = mockContract.on.mock.calls.find((call: any) => call[0] === 'Transfer')?.[1];
      expect(eventHandler).toBeDefined();
      
      // Call with invalid arguments to trigger error handling
      await eventHandler(); // No arguments
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Error handling contract event:'),
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('should handle BigInt values in event arguments', async () => {
      await eventListener.start();
      eventListener.addSubscription(testSubscription);
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Trigger an event with BigInt values
      const eventHandler = mockContract.on.mock.calls.find((call: any) => call[0] === 'Transfer')?.[1];
      const mockEvent = {
        fragment: { name: 'Transfer' },
        log: {
          address: testSubscription.contractAddress,
          blockNumber: 12345,
          transactionHash: '0xabcdef',
          index: 0
        }
      };
      
      const bigIntValue = BigInt('1000000000000000000');
      await eventHandler('0x123', '0x456', bigIntValue, mockEvent);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('value: 1000000000000000000')
      );
      
      consoleLogSpy.mockRestore();
    });

    it('should handle multiple contract addresses in subscription', async () => {
      const multiContractSubscription: EventSubscription = {
        ...testSubscription,
        id: 'multi-contract-subscription',
        contractAddress: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222'
        ]
      };
      
      await eventListener.start();
      
      // Clear previous calls to get accurate count for this test
      MockedContract.mockClear();
      
      eventListener.addSubscription(multiContractSubscription);
      
      // Should create contracts for both addresses
      expect(MockedContract).toHaveBeenCalledTimes(2);
    });

    it('should handle array event signatures in subscription', async () => {
      const multiEventSubscription: EventSubscription = {
        ...testSubscription,
        id: 'multi-event-subscription',
        eventSignature: [
          'Transfer(address indexed from, address indexed to, uint256 value)',
          'Approval(address indexed owner, address indexed spender, uint256 value)'
        ]
      };
      
      await eventListener.start();
      eventListener.addSubscription(multiEventSubscription);
      
      // Should listen for both events
      expect(mockContract.on).toHaveBeenCalledWith('Transfer', expect.any(Function));
      expect(mockContract.on).toHaveBeenCalledWith('Approval', expect.any(Function));
    });

    it('should handle subscription with array contract addresses', async () => {
      const subscriptionWithArrayAddresses: EventSubscription = {
        ...testSubscription,
        id: 'array-addresses-subscription',
        contractAddress: ['0x1234567890123456789012345678901234567890', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd']
      };

      await eventListener.start();
      eventListener.addSubscription(subscriptionWithArrayAddresses);

      // Should create contracts for each address
      expect(MockedContract).toHaveBeenCalledTimes(3);
    });

    it('should handle removal of subscription with array contract addresses', async () => {
      const subscriptionWithArrayAddresses: EventSubscription = {
        ...testSubscription,
        id: 'array-addresses-subscription',
        contractAddress: ['0x1234567890123456789012345678901234567890', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd']
      };

      await eventListener.start();
      eventListener.addSubscription(subscriptionWithArrayAddresses);
      
      // Add another subscription with one of the same addresses
      const anotherSubscription: EventSubscription = {
        ...testSubscription,
        id: 'another-sub',
        contractAddress: '0x1234567890123456789012345678901234567890'
      };
      eventListener.addSubscription(anotherSubscription);

      // Remove the first subscription
      eventListener.removeSubscription('array-addresses-subscription');

      // Should not remove contract monitoring for the shared address
      expect(mockConnection.removeContractFromMonitor).toHaveBeenCalledWith('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      expect(mockConnection.removeContractFromMonitor).not.toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });

    it('should handle subscription with single contract address when checking for other subscriptions', async () => {
      const subscription1: EventSubscription = {
        ...testSubscription,
        id: 'sub1',
        contractAddress: '0x1234567890123456789012345678901234567890'
      };
      
      const subscription2: EventSubscription = {
        ...testSubscription,
        id: 'sub2',
        contractAddress: ['0x1234567890123456789012345678901234567890', '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd']
      };

      await eventListener.start();
      eventListener.addSubscription(subscription1);
      eventListener.addSubscription(subscription2);

      // Remove subscription2
      eventListener.removeSubscription('sub2');

      // Should not remove contract monitoring for the shared address
      expect(mockConnection.removeContractFromMonitor).toHaveBeenCalledWith('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
      expect(mockConnection.removeContractFromMonitor).not.toHaveBeenCalledWith('0x1234567890123456789012345678901234567890');
    });

    it('should handle config loading with invalid subscription configurations', async () => {
      const invalidConfig = {
        subscriptions: [
          {
            // Missing required fields
            id: 'invalid-sub'
          },
          {
            // Valid subscription
            id: 'valid-sub',
            contractAddress: '0x1234567890123456789012345678901234567890',
            eventSignature: 'Transfer(address,address,uint256)',
            webhooks: []
          }
        ]
      };

      // Mock fs.readFileSync to return invalid config
      const mockReadFileSync = jest.spyOn(require('fs'), 'readFileSync').mockReturnValue(JSON.stringify(invalidConfig));

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await eventListener.start();

      // Should skip invalid subscription and warn
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid subscription configuration:'),
        expect.objectContaining({ id: 'invalid-sub' })
      );
      
      mockReadFileSync.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should handle config loading with malformed JSON gracefully', async () => {
      // Mock fs.readFileSync to return malformed JSON
      const mockReadFileSync = jest.spyOn(require('fs'), 'readFileSync').mockReturnValue('{ invalid json }');

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await eventListener.start();

      // Should handle JSON parse error gracefully
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error loading configuration:'),
        expect.any(Error)
      );
      
      mockReadFileSync.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should handle config without subscriptions', async () => {
      const configWithoutSubscriptions = {
        network: {
          rpcUrl: 'https://test.rpc.url'
        }
      };

      // Mock fs.readFileSync to return config without subscriptions
      const mockReadFileSync = jest.spyOn(require('fs'), 'readFileSync').mockReturnValue(JSON.stringify(configWithoutSubscriptions));

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await eventListener.start();

      // Should handle missing subscriptions gracefully
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      
      mockReadFileSync.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should not duplicate existing subscriptions from config', async () => {
      const configWithDuplicates = {
        subscriptions: [
          {
            id: testSubscription.id, // Same ID as existing subscription
            contractAddress: '0x1234567890123456789012345678901234567890',
            eventSignature: 'Transfer(address,address,uint256)',
            webhooks: []
          }
        ]
      };

      // Add subscription first
      eventListener.addSubscription(testSubscription);

      // Mock fs.readFileSync to return config with duplicate
      const mockReadFileSync = jest.spyOn(require('fs'), 'readFileSync').mockReturnValue(JSON.stringify(configWithDuplicates));

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await eventListener.start();

      // Should not add duplicate subscription
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Added subscription:'));
      
      mockReadFileSync.mockRestore();
      consoleLogSpy.mockRestore();
    });
  });
});

function parseEventArgs(signature: string, args: string[]) {
  // Extract parameter names from the signature
  const match = signature.match(/\(([^)]*)\)/);
  const params = match && match[1]
    ? match[1].split(',').map(p => p.trim()).filter(Boolean)
    : [];

  const result: Record<string, any> = {};

  // Add indexed keys
  args.forEach((arg, i) => {
    result[i.toString()] = arg;
  });

  // Add named keys if available
  if (params.length > 0 && params[0] !== '') {
    params.forEach((param, i) => {
      // Try to extract the name (e.g., "address from" or just "address")
      const parts = param.split(' ').map(s => s.trim()).filter(Boolean);
      let name: string | undefined;
      if (parts.length === 2) {
        name = parts[1];
      } else if (parts.length === 1) {
        // No name, fallback to paramN
        name = `param${i}`;
      } else {
        name = `param${i}`;
      }
      if (name !== undefined) {
        result[name] = args[i];
      }
    });
  }

  return result;
}

