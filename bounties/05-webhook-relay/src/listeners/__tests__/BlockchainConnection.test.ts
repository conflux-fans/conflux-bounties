import { BlockchainConnection } from '../BlockchainConnection';
import { NetworkConfig } from '../../types/config';
import { ethers } from 'ethers';

// Mock ethers
jest.mock('ethers', () => ({
  ethers: {
    WebSocketProvider: jest.fn()
  }
}));

const MockedWebSocketProvider = ethers.WebSocketProvider as jest.MockedClass<typeof ethers.WebSocketProvider>;

describe('BlockchainConnection', () => {
  let connection: BlockchainConnection;
  let mockProvider: any;
  let mockWebSocket: any;
  let networkConfig: NetworkConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();

    // Create mock WebSocket
    mockWebSocket = {
      readyState: 0, // CONNECTING
      on: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      removeListener: jest.fn()
    };

    // Create mock provider
    mockProvider = {
      websocket: mockWebSocket,
      destroy: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      removeAllListeners: jest.fn(),
      getBlockNumber: jest.fn().mockResolvedValue(123456) // Mock getBlockNumber
    };

    // Mock WebSocketProvider constructor
    MockedWebSocketProvider.mockImplementation(() => mockProvider);

    networkConfig = {
      rpcUrl: 'https://evm.confluxrpc.com',
      wsUrl: 'wss://evm.confluxrpc.com/ws',
      chainId: 1030,
      confirmations: 1
    };

    connection = new BlockchainConnection(networkConfig);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with network config', () => {
      expect(connection).toBeInstanceOf(BlockchainConnection);
    });
  });

  describe('connect', () => {
    it('should connect successfully with WebSocket URL', async () => {
      // Simulate successful connection
      mockWebSocket.readyState = 1; // OPEN

      const connectPromise = connection.connect();
      
      // Simulate WebSocket open event
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();

      await connectPromise;

      expect(MockedWebSocketProvider).toHaveBeenCalledWith(
        networkConfig.wsUrl,
        networkConfig.chainId
      );
      expect(connection.isConnected()).toBe(true);
    });

    it('should throw error if no WebSocket URL provided', async () => {
      const configWithoutWs = { ...networkConfig };
      delete (configWithoutWs as any).wsUrl;
      const connectionWithoutWs = new BlockchainConnection(configWithoutWs);

      await expect(connectionWithoutWs.connect()).rejects.toThrow(
        'WebSocket URL required for real-time event monitoring'
      );
    });

    it('should not connect if already connected', async () => {
      mockWebSocket.readyState = 1;
      
      // First connection
      const connectPromise1 = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise1;

      // Reset mock calls
      MockedWebSocketProvider.mockClear();

      // Second connection attempt
      await connection.connect();

      // Should not create new provider
      expect(MockedWebSocketProvider).not.toHaveBeenCalled();
    });

    it('should emit connected event on successful connection', async () => {
      const connectedSpy = jest.fn();
      connection.on('connected', connectedSpy);

      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      
      await connectPromise;

      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should handle connection timeout', async () => {
      mockWebSocket.readyState = 0; // Keep in CONNECTING state

      const connectPromise = connection.connect();
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(10000);

      await expect(connectPromise).rejects.toThrow('Connection timeout');
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;
    });

    it('should disconnect successfully', async () => {
      const disconnectedSpy = jest.fn();
      connection.on('disconnected', disconnectedSpy);

      await connection.disconnect();

      expect(mockProvider.destroy).toHaveBeenCalled();
      expect(disconnectedSpy).toHaveBeenCalled();
      expect(connection.isConnected()).toBe(false);
    });

    it('should clear health check interval on disconnect', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      await connection.disconnect();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should disconnect successfully when provider is null', async () => {
      const disconnectedSpy = jest.fn();
      
      // Create a new connection that was never connected
      const unconnectedConnection = new BlockchainConnection(networkConfig);
      unconnectedConnection.on('disconnected', disconnectedSpy);

      await unconnectedConnection.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should handle disconnect when provider becomes null during cleanup', async () => {
      const disconnectedSpy = jest.fn();
      connection.on('disconnected', disconnectedSpy);

      // Manually set provider to null to simulate edge case
      (connection as any).provider = null;

      await connection.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should always emit disconnected event regardless of provider state', async () => {
      const disconnectedSpy = jest.fn();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Test with various connection states
      const testConnection = new BlockchainConnection(networkConfig);
      testConnection.on('disconnected', disconnectedSpy);

      await testConnection.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
      // Use substring matching to avoid emoji/encoding issues
      const logs = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logs).toMatch(/Stopping blockchain connection/);
      expect(logs).toMatch(/Blockchain connection stopped/);
      consoleLogSpy.mockRestore();
    });

    it('should handle setupProviderEventHandlers when provider is null', async () => {
      // Create a connection and manually call setupProviderEventHandlers with null provider
      const testConnection = new BlockchainConnection(networkConfig);
      
      // Access private method through any cast for testing
      const setupProviderEventHandlers = (testConnection as any).setupProviderEventHandlers;
      
      // This should return early without throwing an error
      expect(() => setupProviderEventHandlers.call(testConnection)).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(connection.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      expect(connection.isConnected()).toBe(true);
    });

    it('should return false when WebSocket is not in OPEN state', async () => {
      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      // Simulate connection loss
      mockWebSocket.readyState = 3; // CLOSED

      expect(connection.isConnected()).toBe(false);
    });
  });

  describe('reconnection logic', () => {
    it('should attempt reconnection on WebSocket close', async () => {
      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      // Reset provider mock for reconnection
      MockedWebSocketProvider.mockClear();

      // Simulate WebSocket close
      const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      if (closeHandler) closeHandler(1000, 'Normal closure');


      // Fast-forward to trigger reconnection (initial delay is 2000ms)
      jest.advanceTimersByTime(2000);

      expect(MockedWebSocketProvider).toHaveBeenCalled();
    });

    it('should use exponential backoff for reconnection attempts', async () => {
      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout');

      // Simulate multiple connection failures
      for (let i = 0; i < 3; i++) {
        MockedWebSocketProvider.mockImplementation(() => {
          throw new Error('Connection failed');
        });

        const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        if (closeHandler) closeHandler(1000, 'Connection failed');

        jest.advanceTimersByTime(1000 * Math.pow(2, i));
      }

      // Verify exponential backoff delays
      const delays = setTimeoutSpy.mock.calls.map(call => call[1]);
      // The actual delays observed in the error are [2000, 4000, 8000]
      expect(delays).toContain(2000); // First attempt
      expect(delays).toContain(4000); // Second attempt
      expect(delays).toContain(8000); // Third attempt
    });

    it('should emit maxReconnectAttemptsReached after max attempts', async () => {
      const maxAttemptsSpy = jest.fn();
      connection.on('maxReconnectAttemptsReached', maxAttemptsSpy);

      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      // Simulate max reconnection attempts (5)
      for (let i = 0; i < 6; i++) {
        MockedWebSocketProvider.mockImplementation(() => {
          throw new Error('Connection failed');
        });

        const closeHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        if (closeHandler) closeHandler(1000, 'Connection failed');

        jest.advanceTimersByTime(30000); // Max delay
      }

      expect(maxAttemptsSpy).toHaveBeenCalled();
    });
  });

  describe('health monitoring', () => {
    it('should start health monitoring after connection', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');

      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should emit healthCheckFailed when connection is lost', async () => {
      const healthFailedSpy = jest.fn();
      connection.on('healthCheckFailed', healthFailedSpy);

      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      // Simulate connection loss
      mockWebSocket.readyState = 3; // CLOSED

      // Trigger health check
      jest.advanceTimersByTime(30000);

      expect(healthFailedSpy).toHaveBeenCalled();
    });
  });

  describe('event handling', () => {
    it('should handle provider errors', async () => {
      const errorSpy = jest.fn();
      connection.on('error', errorSpy);

      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      // Simulate provider error
      const errorHandler = mockProvider.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      const testError = new Error('Provider error');
      if (errorHandler) errorHandler(testError);

      expect(errorSpy).toHaveBeenCalledWith(testError);
    });

    it('should handle WebSocket errors', async () => {
      const errorSpy = jest.fn();
      connection.on('error', errorSpy);

      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      // Simulate WebSocket error
      const wsErrorHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      const testError = new Error('WebSocket error');
      if (wsErrorHandler) wsErrorHandler(testError);

      expect(errorSpy).toHaveBeenCalledWith(testError);
    });
  });

  describe('getProvider', () => {
    it('should return null when not connected', () => {
      expect(connection.getProvider()).toBeNull();
    });

    it('should return provider when connected', async () => {
      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      expect(connection.getProvider()).toBe(mockProvider);
    });
  });

  describe('onEvent', () => {
    it('should register callback for blockchain events', () => {
      const callback = jest.fn();
      const onSpy = jest.spyOn(connection, 'on');

      connection.onEvent(callback);

      expect(onSpy).toHaveBeenCalledWith('blockchainEvent', callback);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle provider cleanup errors during disconnect', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const cleanupError = new Error('Cleanup failed');

      mockWebSocket.readyState = 1;
      const connectPromise = connection.connect();
      const openHandler = mockWebSocket.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      if (openHandler) openHandler();
      await connectPromise;

      // Mock provider.destroy to throw an error
      mockProvider.destroy.mockRejectedValue(cleanupError);

      await connection.disconnect();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error during provider cleanup:', cleanupError);
      consoleErrorSpy.mockRestore();
    });

    it('should handle connection errors with reconnection enabled', async () => {
      const connectionError = new Error('Connection failed');
      MockedWebSocketProvider.mockImplementation(() => {
        throw connectionError;
      });

      const errorSpy = jest.fn();
      connection.on('error', errorSpy);

      await expect(connection.connect()).rejects.toThrow('Connection failed');
      expect(errorSpy).toHaveBeenCalledWith(connectionError);
    });

    it('should throw error when provider not initialized in waitForConnection', async () => {
      // Create a connection instance and directly call the private method
      const testConnection = new BlockchainConnection(networkConfig);
      
      // Access private method through any cast for testing
      const waitForConnection = (testConnection as any).waitForConnection;
      
      await expect(waitForConnection.call(testConnection)).rejects.toThrow('Provider not initialized');
    });

    it('should handle immediate connection success in waitForConnection', async () => {
      mockWebSocket.readyState = 1; // Already connected

      const connectPromise = connection.connect();
      
      // Should resolve immediately without waiting for open event
      await connectPromise;

      expect(connection.isConnected()).toBe(true);
    });

    it('should wait for WebSocket open event when not immediately ready', async () => {
      // Start with connecting state (not ready)
      mockWebSocket.readyState = 0; // CONNECTING

      // Mock the on method to immediately call the handler when 'open' is registered
      mockWebSocket.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'open') {
          // Simulate the WebSocket becoming ready and trigger the handler
          setTimeout(() => {
            mockWebSocket.readyState = 1; // OPEN
            handler();
          }, 0);
        }
      });

      const connectPromise = connection.connect();
      
      // Advance timers to trigger the setTimeout in the mock
      jest.advanceTimersByTime(0);
      
      await connectPromise;

      expect(connection.isConnected()).toBe(true);
      expect(mockWebSocket.on).toHaveBeenCalledWith('open', expect.any(Function));
    });

    it('should handle WebSocket not available error in waitForConnection', async () => {
      // Create a provider without websocket property
      const providerWithoutWebSocket = {
        ...mockProvider,
        websocket: null
      };

      MockedWebSocketProvider.mockImplementation(() => providerWithoutWebSocket as any);

      await expect(connection.connect()).rejects.toThrow('WebSocket not available');
    });


  });
});