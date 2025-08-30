import { Application } from '../Application';
import { ConfigManager } from '../config/ConfigManager';
import { DatabaseConnection } from '../database/connection';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SystemConfig } from '../types/config';
import express from 'express';

// Mock external dependencies
jest.mock('../config/ConfigManager');
jest.mock('../database/connection');
jest.mock('../listeners/BlockchainConnection');
jest.mock('../listeners/EventListener');
jest.mock('../listeners/EventProcessor', () => {
  return {
    EventProcessor: jest.fn().mockImplementation(() => ({
      addSubscription: jest.fn(),
      removeSubscription: jest.fn(),
      getSubscriptions: jest.fn().mockReturnValue([]),
      loadSubscriptionsFromDatabase: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      isProcessing: jest.fn().mockReturnValue(false)
    }))
  };
});
jest.mock('../filtering/FilterEngine');
jest.mock('../webhooks/queue/DeliveryQueue');
jest.mock('../webhooks/queue/QueuePersistence');
jest.mock('../webhooks/queue/RetryScheduler');
jest.mock('../webhooks/WebhookSender', () => {
  return {
    WebhookSender: jest.fn().mockImplementation(() => ({
      sendWebhook: jest.fn(),
      validateConfig: jest.fn(),
      getWebhookConfig: jest.fn()
    }))
  };
});
jest.mock('../webhooks/HttpClient', () => {
  return {
    HttpClient: jest.fn().mockImplementation(() => ({
      post: jest.fn(),
      cleanup: jest.fn()
    }))
  };
});
jest.mock('../webhooks/DeliveryTracker', () => {
  return {
    DeliveryTracker: jest.fn().mockImplementation(() => ({
      trackDelivery: jest.fn(),
      getDeliveryStats: jest.fn(),
      getRecentDeliveries: jest.fn(),
      clearHistory: jest.fn()
    }))
  };
});
jest.mock('../webhooks/QueueProcessor', () => {
  return {
    QueueProcessor: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      isRunning: jest.fn().mockReturnValue(false),
      getStats: jest.fn().mockResolvedValue({
        isRunning: false,
        totalProcessed: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        currentQueueSize: 0,
        processingCount: 0,
        maxConcurrentDeliveries: 10,
        rateLimitedCount: 0,
        queueBacklogWarnings: 0
      })
    }))
  };
});
jest.mock('../webhooks/WebhookConfigProvider');
jest.mock('express');

const MockedConfigManager = ConfigManager as jest.MockedClass<typeof ConfigManager>;
const MockedDatabaseConnection = DatabaseConnection as jest.MockedClass<typeof DatabaseConnection>;
const MockedExpress = express as jest.MockedFunction<typeof express>;

describe('Application', () => {
  let app: Application;
  let mockConfig: SystemConfig;
  let configPath: string;

  beforeEach(async () => {
    // Set test environment
    process.env['NODE_ENV'] = 'test';

    // Create a temporary config file for testing
    configPath = path.join(__dirname, 'test-config.json');
    mockConfig = {
      network: {
        rpcUrl: 'https://evm.confluxrpc.com',
        wsUrl: 'wss://evm.confluxrpc.com/ws',
        chainId: 1030,
        confirmations: 1
      },
      subscriptions: [
        {
          id: 'test-subscription',
          contractAddress: '0x1234567890123456789012345678901234567890',
          eventSignature: 'Transfer(address,address,uint256)',
          filters: {},
          webhooks: [
            {
              id: 'test-webhook',
              url: 'https://example.com/webhook',
              format: 'generic' as const,
              headers: {},
              timeout: 30000,
              retryAttempts: 3
            }
          ]
        }
      ],
      database: {
        url: 'postgresql://test:test@localhost:5432/test',
        poolSize: 10,
        connectionTimeout: 5000
      },
      redis: {
        url: 'redis://localhost:6379',
        keyPrefix: 'webhook-relay:',
        ttl: 3600
      },
      monitoring: {
        logLevel: 'info',
        metricsEnabled: true,
        healthCheckPort: 3001
      },
      options: {
        maxConcurrentWebhooks: 10,
        defaultRetryAttempts: 3,
        defaultRetryDelay: 1000,
        webhookTimeout: 30000,
        queueProcessingInterval: 1000
      }
    };

    await fs.writeFile(configPath, JSON.stringify(mockConfig, null, 2));

    // Setup mocks
    MockedConfigManager.prototype.loadConfig = jest.fn().mockResolvedValue(mockConfig);
    MockedConfigManager.prototype.onConfigChange = jest.fn();
    MockedConfigManager.prototype.on = jest.fn();

    MockedDatabaseConnection.prototype.healthCheck = jest.fn().mockResolvedValue(true);
    MockedDatabaseConnection.prototype.close = jest.fn().mockResolvedValue(undefined);

    // Ensure all mocked classes have proper constructors that don't throw
    jest.clearAllMocks();

    // Ensure EventProcessor mock is properly set up for each test
    const MockedEventProcessor = require('../listeners/EventProcessor').EventProcessor;
    MockedEventProcessor.mockImplementation(() => ({
      addSubscription: jest.fn(),
      removeSubscription: jest.fn(),
      getSubscriptions: jest.fn().mockReturnValue([]),
      loadSubscriptionsFromDatabase: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      isProcessing: jest.fn().mockReturnValue(false)
    }));

    // Ensure QueueProcessor mock is properly set up for each test
    const MockedQueueProcessor = require('../webhooks/QueueProcessor').QueueProcessor;
    MockedQueueProcessor.mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      isRunning: jest.fn().mockReturnValue(false),
      getStats: jest.fn().mockResolvedValue({
        isRunning: false,
        totalProcessed: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        currentQueueSize: 0,
        processingCount: 0,
        maxConcurrentDeliveries: 10,
        rateLimitedCount: 0,
        queueBacklogWarnings: 0
      })
    }));

    // Setup express mock
    const mockServer = {
      close: jest.fn().mockImplementation((callback) => {
        if (callback) callback();
      })
    };

    const mockApp = {
      get: jest.fn(),
      listen: jest.fn().mockImplementation((_port, callback) => {
        if (callback) callback();
        return mockServer;
      })
    };

    MockedExpress.mockReturnValue(mockApp as any);

    app = new Application({
      configPath,
      enableHealthEndpoint: false, // Disable for testing to avoid port conflicts
      gracefulShutdownTimeout: 5000
    });
  });

  afterEach(async () => {
    // Clean up with timeout to prevent hanging
    try {
      // Remove all listeners to prevent memory leaks
      if (app) {
        app.removeAllListeners();
        
        // Stop with timeout
        await Promise.race([
          app.stop(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('App stop timeout')), 5000))
        ]);
      }
    } catch (error) {
      console.warn('Error during app cleanup:', error);
    }

    // Clean up config file
    try {
      await fs.unlink(configPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }

    // Clean up global resources
    if ((global as any).cleanupGlobalResources) {
      try {
        await (global as any).cleanupGlobalResources();
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    jest.clearAllMocks();
    jest.resetAllMocks();
    jest.clearAllTimers();
  });

  describe('Application Lifecycle', () => {
    it('should start successfully with valid configuration', async () => {
      const startedSpy = jest.fn();
      app.on('started', startedSpy);

      await app.start();

      expect(startedSpy).toHaveBeenCalled();
      expect(app.getStatus().status).toBe('running');
      expect(app.getStatus().startTime).toBeDefined();
      expect(app.getStatus().uptime).toBeGreaterThanOrEqual(0);
    });

    it('should stop gracefully', async () => {
      const stoppedSpy = jest.fn();
      app.on('stopped', stoppedSpy);

      await app.start();
      await app.stop();

      expect(stoppedSpy).toHaveBeenCalled();
      expect(app.getStatus().status).toBe('stopped');
    });

    it('should handle startup errors gracefully', async () => {
      // Create a new app instance with failing config
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });

      // Mock configuration loading to fail for this specific instance
      const mockConfigManager = (failingApp as any).configManager;
      mockConfigManager.loadConfig = jest.fn().mockRejectedValue(new Error('Config load failed'));

      const errorSpy = jest.fn();
      failingApp.on('error', errorSpy);

      await expect(failingApp.start()).rejects.toThrow('Config load failed');
      expect(errorSpy).toHaveBeenCalled();
      expect(failingApp.getStatus().status).toBe('error');
    });

    it('should handle database connection failure', async () => {
      // Mock database health check to fail
      MockedDatabaseConnection.prototype.healthCheck = jest.fn().mockResolvedValue(false);

      await expect(app.start()).rejects.toThrow('Database health check failed');
      expect(app.getStatus().status).toBe('error');
    });

    it('should not start if already running', async () => {
      await app.start();

      // Try to start again
      await app.start(); // Should not throw, just log warning

      expect(app.getStatus().status).toBe('running');
    });

    it('should not stop if already stopped', async () => {
      // Try to stop without starting
      await app.stop(); // Should not throw, just log warning

      expect(app.getStatus().status).toBe('stopped');
    });

    it('should emit lifecycle events', async () => {
      const startingSpy = jest.fn();
      const startedSpy = jest.fn();
      const stoppingSpy = jest.fn();
      const stoppedSpy = jest.fn();

      app.on('starting', startingSpy);
      app.on('started', startedSpy);
      app.on('stopping', stoppingSpy);
      app.on('stopped', stoppedSpy);

      await app.start();
      await app.stop();

      expect(startingSpy).toHaveBeenCalled();
      expect(startedSpy).toHaveBeenCalled();
      expect(stoppingSpy).toHaveBeenCalled();
      expect(stoppedSpy).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should load configuration on startup', async () => {
      await app.start();

      expect(MockedConfigManager.prototype.loadConfig).toHaveBeenCalled();
      expect(app.getStatus().components.config).toBe(true);
    });

    it('should handle configuration reload', async () => {
      const configReloadedSpy = jest.fn();
      app.on('configReloaded', configReloadedSpy);

      await app.start();

      // Mock the event processor with proper methods
      const mockEventProcessor = {
        getSubscriptions: jest.fn().mockReturnValue([
          { id: 'existing-subscription' }
        ]),
        removeSubscription: jest.fn(),
        addSubscription: jest.fn(),
        loadSubscriptionsFromDatabase: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        isProcessing: jest.fn().mockReturnValue(false)
      };
      (app as any).eventProcessor = mockEventProcessor;

      // Simulate configuration change
      const configChangeCallback = (MockedConfigManager.prototype.onConfigChange as jest.Mock).mock.calls[0][0];
      const newConfig = { ...mockConfig, monitoring: { ...mockConfig.monitoring, logLevel: 'debug' } };

      await configChangeCallback(newConfig);

      expect(configReloadedSpy).toHaveBeenCalledWith(newConfig);
    });

    it('should handle configuration reload errors', async () => {
      const configReloadErrorSpy = jest.fn();
      app.on('configReloadError', configReloadErrorSpy);

      await app.start();

      // Simulate configuration change with invalid config
      const configChangeCallback = (MockedConfigManager.prototype.onConfigChange as jest.Mock).mock.calls[0][0];

      // Mock event processor to throw error
      const mockEventProcessor = {
        getSubscriptions: jest.fn().mockReturnValue([]),
        removeSubscription: jest.fn(),
        addSubscription: jest.fn().mockImplementation(() => {
          throw new Error('Subscription error');
        }),
        loadSubscriptionsFromDatabase: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        isProcessing: jest.fn().mockReturnValue(false)
      };

      (app as any).eventProcessor = mockEventProcessor;

      await configChangeCallback(mockConfig);

      expect(configReloadErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Component Status', () => {
    it('should report component status correctly', async () => {
      const initialStatus = app.getStatus();
      expect(initialStatus.components.config).toBe(false);
      expect(initialStatus.components.database).toBe(false);
      expect(initialStatus.components.eventProcessor).toBe(false);
      expect(initialStatus.components.queueProcessor).toBe(false);

      await app.start();

      const runningStatus = app.getStatus();
      expect(runningStatus.components.config).toBe(true);
      expect(runningStatus.components.database).toBe(true);
      // Note: eventProcessor and queueProcessor status depend on mocked implementations
    });

    it('should calculate uptime correctly', async () => {
      await app.start();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = app.getStatus();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should skip signal handlers in test environment', () => {
      // In test environment, signal handlers should be skipped
      // This test verifies that the application doesn't crash when signal handlers are not set up
      expect(process.env['NODE_ENV']).toBe('test');

      // The application should start and stop normally without signal handlers
      expect(app).toBeDefined();
    });

    it('should handle configuration errors gracefully', async () => {
      // Create a new app instance with failing config
      const failingApp = new Application({
        configPath: 'non-existent-config.json',
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });

      // Mock configuration loading to fail for this specific instance
      const mockConfigManager = (failingApp as any).configManager;
      mockConfigManager.loadConfig = jest.fn().mockRejectedValue(new Error('Config load failed'));

      const errorSpy = jest.fn();
      failingApp.on('error', errorSpy);

      await expect(failingApp.start()).rejects.toThrow('Configuration initialization failed: Config load failed');
      expect(errorSpy).toHaveBeenCalled();
      expect(failingApp.getStatus().status).toBe('error');
    });

    it('should handle component initialization failures', async () => {
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });
      const errorSpy = jest.fn();
      failingApp.on('error', errorSpy);
      // Mock the initializeComponents method to throw an error
      const originalInitializeComponents = (failingApp as any).initializeComponents;
      (failingApp as any).initializeComponents = jest.fn().mockRejectedValue(new Error('Component initialization failed'));
      await expect(failingApp.start()).rejects.toThrow('Component initialization failed');
      expect(errorSpy).toHaveBeenCalled();
      expect(failingApp.getStatus().status).toBe('error');
      // Restore the original method
      (failingApp as any).initializeComponents = originalInitializeComponents;
    });

    it('should handle health server startup failure', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      // Mock express app.listen to fail
      const mockApp = {
        get: jest.fn(),
        listen: jest.fn().mockImplementation((_port, callback) => {
          if (callback) callback(new Error('Port already in use'));
        })
      };
      MockedExpress.mockReturnValue(mockApp as any);

      const errorSpy = jest.fn();
      healthApp.on('error', errorSpy);

      await expect(healthApp.start()).rejects.toThrow('Failed to start health server: Port already in use');
      expect(errorSpy).toHaveBeenCalled();
      expect(healthApp.getStatus().status).toBe('error');
    });

    it('should handle event processing startup failure', async () => {
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });
      const errorSpy = jest.fn();
      failingApp.on('error', errorSpy);
      // Mock the startEventProcessing method to throw an error
      const originalStartEventProcessing = (failingApp as any).startEventProcessing;
      (failingApp as any).startEventProcessing = jest.fn().mockRejectedValue(new Error('Event processing failed'));
      await expect(failingApp.start()).rejects.toThrow('Event processing failed');
      expect(errorSpy).toHaveBeenCalled();
      // Restore the original method
      (failingApp as any).startEventProcessing = originalStartEventProcessing;
    });

    it('should handle queue processing startup failure', async () => {
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });
      const errorSpy = jest.fn();
      failingApp.on('error', errorSpy);
      // Mock the startQueueProcessing method to throw an error
      const originalStartQueueProcessing = (failingApp as any).startQueueProcessing;
      (failingApp as any).startQueueProcessing = jest.fn().mockRejectedValue(new Error('Queue processing failed'));
      await expect(failingApp.start()).rejects.toThrow('Queue processing failed');
      expect(errorSpy).toHaveBeenCalled();
      // Restore the original method
      (failingApp as any).startQueueProcessing = originalStartQueueProcessing;
    });

    it('should handle shutdown errors gracefully', async () => {
      await app.start();

      // Mock components to throw errors during shutdown
      const mockEventProcessor = (app as any).eventProcessor;
      const mockQueueProcessor = (app as any).queueProcessor;
      const mockBlockchainConnection = (app as any).blockchainConnection;
      const mockDatabaseConnection = (app as any).databaseConnection;

      mockEventProcessor.stop = jest.fn().mockRejectedValue(new Error('Event processor stop failed'));
      mockQueueProcessor.stop = jest.fn().mockRejectedValue(new Error('Queue processor stop failed'));
      mockBlockchainConnection.disconnect = jest.fn().mockRejectedValue(new Error('Blockchain disconnect failed'));
      mockDatabaseConnection.close = jest.fn().mockRejectedValue(new Error('Database close failed'));

      // Should not throw, but should log errors
      await app.stop();

      expect(app.getStatus().status).toBe('stopped');
    });

    it('should handle database initialization errors', async () => {
      // Mock database connection to throw error
      MockedDatabaseConnection.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(app.start()).rejects.toThrow('Database initialization failed: Database connection failed');
      expect(app.getStatus().status).toBe('error');
    });

    it('should handle missing configuration during database initialization', async () => {
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });

      // Clear the config to simulate missing configuration
      (failingApp as any).config = null;

      // Mock the initializeDatabase method to be called directly
      const initializeDatabase = (failingApp as any).initializeDatabase.bind(failingApp);

      await expect(initializeDatabase()).rejects.toThrow('Configuration not loaded');
    });

    it('should handle missing prerequisites during component initialization', async () => {
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });

      // Clear the config and database to simulate missing prerequisites
      (failingApp as any).config = null;
      (failingApp as any).databaseConnection = null;

      // Mock the initializeComponents method to be called directly
      const initializeComponents = (failingApp as any).initializeComponents.bind(failingApp);

      await expect(initializeComponents()).rejects.toThrow('Prerequisites not initialized');
    });

    it('should handle missing configuration during health server start', async () => {
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      // Clear the config to simulate missing configuration
      (failingApp as any).config = null;

      // Mock the startHealthServer method to be called directly
      const startHealthServer = (failingApp as any).startHealthServer.bind(failingApp);

      await expect(startHealthServer()).rejects.toThrow('Configuration not loaded');
    });

    it('should handle missing event processor during event processing start', async () => {
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });

      // Set config but clear event processor
      (failingApp as any).config = mockConfig;
      (failingApp as any).eventProcessor = null;

      // Mock the startEventProcessing method to be called directly
      const startEventProcessing = (failingApp as any).startEventProcessing.bind(failingApp);

      await expect(startEventProcessing()).rejects.toThrow('Event processor not initialized');
    });

    it('should handle missing queue processor during queue processing start', async () => {
      const failingApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });

      // Clear queue processor
      (failingApp as any).queueProcessor = null;

      // Mock the startQueueProcessing method to be called directly
      const startQueueProcessing = (failingApp as any).startQueueProcessing.bind(failingApp);

      await expect(startQueueProcessing()).rejects.toThrow('Queue processor not initialized');
    });

    it('should handle configuration manager errors', async () => {
      const configErrorSpy = jest.fn();
      app.on('configError', configErrorSpy);

      // Simulate configuration manager error
      const configManagerErrorCallback = (MockedConfigManager.prototype.on as jest.Mock).mock.calls
        .find((call: any) => call[0] === 'error')[1];

      const testError = new Error('Config manager error');
      configManagerErrorCallback(testError);

      expect(configErrorSpy).toHaveBeenCalledWith(testError);
    });

    it('should handle shutdown when already in progress', async () => {
      await app.start();

      // Set shutdown in progress flag
      (app as any).shutdownInProgress = true;

      // Try to stop again - should log warning and return early
      await app.stop();

      expect(app.getStatus().status).toBe('running'); // Should still be running since shutdown was skipped
    });

    it('should handle isRunning method correctly', async () => {
      expect(app.isRunning()).toBe(false);

      await app.start();
      expect(app.isRunning()).toBe(true);

      await app.stop();
      expect(app.isRunning()).toBe(false);
    });

    it('should handle component status when processors are null', async () => {
      const status = app.getStatus();

      // When processors are null, their status should be false
      expect(status.components.eventProcessor).toBe(false);
      expect(status.components.queueProcessor).toBe(false);
    });
  });

  describe('Signal Handling', () => {
    it('should skip signal handlers in test environment', () => {
      // Signal handlers are skipped in test environment to prevent worker crashes
      expect(process.env['NODE_ENV']).toBe('test');

      // Verify that the application can be created without setting up signal handlers
      const testApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });

      expect(testApp).toBeDefined();
    });

    it('should provide graceful shutdown timeout option', () => {
      const testApp = new Application({
        configPath,
        gracefulShutdownTimeout: 10000
      });

      expect(testApp).toBeDefined();
      // The timeout is stored in private options, but we can verify the app was created successfully
    });

    it('should setup signal handlers in non-test environment', () => {
      // Temporarily change NODE_ENV to simulate non-test environment
      const originalNodeEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';

      // Mock process.on to track signal handler registration
      const originalProcessOn = process.on;
      const processOnSpy = jest.fn();
      process.on = processOnSpy;

      try {
        const prodApp = new Application({
          configPath,
          enableHealthEndpoint: false,
          gracefulShutdownTimeout: 5000
        });

        // Verify signal handlers were registered
        expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('SIGUSR2', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
        expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));

        expect(prodApp).toBeDefined();
      } finally {
        // Restore original environment and process.on
        process.env['NODE_ENV'] = originalNodeEnv;
        process.on = originalProcessOn;
      }
    });

    it('should handle uncaught exceptions in non-test environment', () => {
      const originalNodeEnv = process.env['NODE_ENV'];
      const originalProcessExit = process.exit;
      process.env['NODE_ENV'] = 'production';

      // Mock process.exit to prevent actual exit
      const processExitSpy = jest.fn();
      process.exit = processExitSpy as any;

      const originalProcessOn = process.on;
      let uncaughtExceptionHandler: Function;
      process.on = jest.fn().mockImplementation((event, handler) => {
        if (event === 'uncaughtException') {
          uncaughtExceptionHandler = handler;
        }
        return process;
      });

      try {
        new Application({
          configPath,
          enableHealthEndpoint: false,
          gracefulShutdownTimeout: 5000
        });

        // Simulate uncaught exception
        const testError = new Error('Test uncaught exception');
        uncaughtExceptionHandler!(testError);

        expect(processExitSpy).toHaveBeenCalledWith(1);
      } finally {
        process.env['NODE_ENV'] = originalNodeEnv;
        process.exit = originalProcessExit;
        process.on = originalProcessOn;
      }
    });

    it('should handle unhandled promise rejections in non-test environment', () => {
      const originalNodeEnv = process.env['NODE_ENV'];
      const originalProcessExit = process.exit;
      process.env['NODE_ENV'] = 'production';

      // Mock process.exit to prevent actual exit
      const processExitSpy = jest.fn();
      process.exit = processExitSpy as any;

      const originalProcessOn = process.on;
      let unhandledRejectionHandler: Function;
      process.on = jest.fn().mockImplementation((event, handler) => {
        if (event === 'unhandledRejection') {
          unhandledRejectionHandler = handler;
        }
        return process;
      });

      try {
        new Application({
          configPath,
          enableHealthEndpoint: false,
          gracefulShutdownTimeout: 5000
        });

        // Simulate unhandled rejection - wrap in try-catch to prevent test failure
        const testReason = 'Test unhandled rejection';
        const testPromise = Promise.reject(testReason);
        
        // Suppress the promise rejection to prevent Jest from failing the test
        testPromise.catch(() => {});
        
        unhandledRejectionHandler!(testReason, testPromise);

        expect(processExitSpy).toHaveBeenCalledWith(1);
      } finally {
        process.env['NODE_ENV'] = originalNodeEnv;
        process.exit = originalProcessExit;
        process.on = originalProcessOn;
      }
    });
  });

  describe('Health Server', () => {
    it('should start health server when enabled', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      await healthApp.start();
      await healthApp.stop();

      // The express mock was set up in beforeEach, so we can check if it was called
      const mockApp = MockedExpress.mock.results[MockedExpress.mock.results.length - 1]?.value;
      expect(mockApp.listen).toHaveBeenCalledWith(3001, expect.any(Function));
    });

    it('should not start health server when disabled', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 5000
      });

      await healthApp.start();
      await healthApp.stop();

      // Health server should not be started
      expect(MockedExpress).not.toHaveBeenCalled();
    });

    it('should handle health endpoint errors', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      // Mock health checker to throw error
      const mockHealthChecker = (healthApp as any).healthChecker;
      mockHealthChecker.checkHealth = jest.fn().mockRejectedValue(new Error('Health check failed'));

      await healthApp.start();

      // Get the health endpoint handler
      const mockApp = MockedExpress.mock.results[MockedExpress.mock.results.length - 1]?.value;
      const healthHandler = mockApp.get.mock.calls.find((call: any) => call[0] === '/health')[1];

      // Mock request and response
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      await healthHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        error: 'Health check failed',
        timestamp: expect.any(Date)
      });

      await healthApp.stop();
    });

    it('should handle metrics endpoint when enabled', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      await healthApp.start();

      // Get the metrics endpoint handler
      const mockApp = MockedExpress.mock.results[MockedExpress.mock.results.length - 1]?.value;
      const metricsHandler = mockApp.get.mock.calls.find((call: any) => call[0] === '/metrics')[1];

      // Mock request and response
      const mockReq = {};
      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      await metricsHandler(mockReq, mockRes);

      // Verify that the response methods were called correctly
      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      expect(mockRes.send).toHaveBeenCalled();
      // Don't check the exact content since it's generated dynamically

      await healthApp.stop();
    });

    it('should handle metrics endpoint errors', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      await healthApp.start();

      // Mock metrics collector to throw error after app is started
      const mockMetricsCollector = (healthApp as any).metricsCollector;
      mockMetricsCollector.getPrometheusMetrics = jest.fn().mockImplementation(() => {
        throw new Error('Metrics failed');
      });

      // Get the metrics endpoint handler
      const mockApp = MockedExpress.mock.results[MockedExpress.mock.results.length - 1]?.value;
      const metricsHandler = mockApp.get.mock.calls.find((call: any) => call[0] === '/metrics')[1];

      // Mock request and response
      const mockReq = {};
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn().mockReturnThis(),
        send: jest.fn()
      };

      await metricsHandler(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Metrics failed'
      });
      expect(mockMetricsCollector.getPrometheusMetrics).toHaveBeenCalled();

      await healthApp.stop();
    });

    it('should return different status codes based on health status', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      const mockHealthChecker = (healthApp as any).healthChecker;
      
      await healthApp.start();

      // Get the health endpoint handler
      const mockApp = MockedExpress.mock.results[MockedExpress.mock.results.length - 1]?.value;
      const healthHandler = mockApp.get.mock.calls.find((call: any) => call[0] === '/health')[1];

      // Test healthy status
      mockHealthChecker.checkHealth = jest.fn().mockResolvedValue({ status: 'healthy' });
      let mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      await healthHandler({}, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);

      // Test degraded status
      mockHealthChecker.checkHealth = jest.fn().mockResolvedValue({ status: 'degraded' });
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      await healthHandler({}, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(200);

      // Test unhealthy status
      mockHealthChecker.checkHealth = jest.fn().mockResolvedValue({ status: 'unhealthy' });
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        set: jest.fn().mockReturnThis(),
        send: jest.fn()
      };
      await healthHandler({}, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(503);

      await healthApp.stop();
    });

    it('should handle health server close errors gracefully', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      // Mock server close to throw error
      const mockServer = {
        close: jest.fn().mockImplementation((callback) => {
          if (callback) callback(new Error('Server close failed'));
        })
      };

      const mockApp = {
        get: jest.fn(),
        listen: jest.fn().mockImplementation((_port, callback) => {
          if (callback) callback();
          return mockServer;
        })
      };

      MockedExpress.mockReturnValue(mockApp as any);

      await healthApp.start();
      
      // Should not throw error during stop
      await healthApp.stop();

      expect(healthApp.getStatus().status).toBe('stopped');
    });

    it('should handle missing health server during stop', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      await healthApp.start();
      
      // Manually clear the health server to simulate missing server
      (healthApp as any).healthServer = null;
      
      // Should not throw error during stop
      await healthApp.stop();

      expect(healthApp.getStatus().status).toBe('stopped');
    });
  });

  describe('additional coverage for uncovered branches', () => {
    it('should handle system metrics collection errors', async () => {
      await app.start();

      // Mock metrics collector to throw error during system metrics collection
      const mockMetricsCollector = (app as any).metricsCollector;
      mockMetricsCollector.recordSystemMetrics = jest.fn().mockImplementation(() => {
        throw new Error('System metrics failed');
      });

      // Trigger system metrics collection
      const startSystemMetricsCollection = (app as any).startSystemMetricsCollection;
      startSystemMetricsCollection.call(app);

      // Should not crash the application
      expect(app.getStatus().status).toBe('running');
    });

    it('should handle missing event processor during isProcessing check', () => {
      // Clear event processor
      (app as any).eventProcessor = null;

      const status = app.getStatus();
      expect(status.components.eventProcessor).toBe(false);
    });

    it('should handle missing queue processor during isProcessing check', () => {
      // Clear queue processor
      (app as any).queueProcessor = null;

      const status = app.getStatus();
      expect(status.components.queueProcessor).toBe(false);
    });

    it('should handle health server close errors', async () => {
      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      await healthApp.start();

      // Mock server close to throw error
      const mockServer = (healthApp as any).healthServer;
      if (mockServer) {
        mockServer.close = jest.fn().mockImplementation((callback) => {
          callback(new Error('Server close failed'));
        });
      }

      // Should not throw error during stop
      await healthApp.stop();
      expect(healthApp.getStatus().status).toBe('stopped');
    });

    it('should handle configuration validation errors during reload', async () => {
      const configReloadErrorSpy = jest.fn();
      app.on('configReloadError', configReloadErrorSpy);

      await app.start();

      // Mock event processor to throw error during addSubscription
      const mockEventProcessor = {
        getSubscriptions: jest.fn().mockReturnValue([]),
        removeSubscription: jest.fn(),
        addSubscription: jest.fn().mockImplementation(() => {
          throw new Error('Subscription validation failed');
        }),
        loadSubscriptionsFromDatabase: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        isProcessing: jest.fn().mockReturnValue(false)
      };
      (app as any).eventProcessor = mockEventProcessor;

      // Simulate configuration change
      const configChangeCallback = (MockedConfigManager.prototype.onConfigChange as jest.Mock).mock.calls[0][0];
      
      await configChangeCallback(mockConfig);

      expect(configReloadErrorSpy).toHaveBeenCalled();
    });

    it('should handle subscription removal errors during config reload', async () => {
      const configReloadErrorSpy = jest.fn();
      app.on('configReloadError', configReloadErrorSpy);

      await app.start();

      // Mock event processor to throw error during subscription removal
      const mockEventProcessor = {
        getSubscriptions: jest.fn().mockReturnValue([
          { id: 'existing-subscription' }
        ]),
        removeSubscription: jest.fn().mockImplementation(() => {
          throw new Error('Remove subscription failed');
        }),
        addSubscription: jest.fn(),
        loadSubscriptionsFromDatabase: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
        isProcessing: jest.fn().mockReturnValue(false)
      };
      (app as any).eventProcessor = mockEventProcessor;

      // Simulate configuration change
      const configChangeCallback = (MockedConfigManager.prototype.onConfigChange as jest.Mock).mock.calls[0][0];
      const newConfig = { ...mockConfig, subscriptions: [] }; // Remove all subscriptions

      await configChangeCallback(newConfig);

      expect(configReloadErrorSpy).toHaveBeenCalled();
    });

    it('should handle metrics collector stop errors', async () => {
      await app.start();

      // Mock metrics collector to throw error during stop
      const mockMetricsCollector = (app as any).metricsCollector;
      mockMetricsCollector.stop = jest.fn().mockImplementation(() => {
        throw new Error('Metrics collector stop failed');
      });

      // Should not throw error during stop
      await app.stop();
      expect(app.getStatus().status).toBe('stopped');
    });

    it('should handle performance monitor stop errors', async () => {
      await app.start();

      // Mock performance monitor to throw error during stop
      const mockPerformanceMonitor = (app as any).performanceMonitor;
      if (mockPerformanceMonitor) {
        mockPerformanceMonitor.stop = jest.fn().mockImplementation(() => {
          throw new Error('Performance monitor stop failed');
        });
      }

      // Should not throw error during stop
      await app.stop();
      expect(app.getStatus().status).toBe('stopped');
    });

    it('should handle health server startup with missing monitoring config', async () => {
      const configWithoutHealthCheckPort = { ...mockConfig };
      // Remove healthCheckPort but keep other monitoring config
      delete (configWithoutHealthCheckPort.monitoring as any).healthCheckPort;

      // Write config without healthCheckPort
      await fs.writeFile(configPath, JSON.stringify(configWithoutHealthCheckPort, null, 2));

      MockedConfigManager.prototype.loadConfig = jest.fn().mockResolvedValue(configWithoutHealthCheckPort);

      const healthApp = new Application({
        configPath,
        enableHealthEndpoint: true,
        gracefulShutdownTimeout: 5000
      });

      // Should use default port when healthCheckPort is missing
      await healthApp.start();
      await healthApp.stop();

      const mockApp = MockedExpress.mock.results[MockedExpress.mock.results.length - 1]?.value;
      // Check that listen was called (port might be undefined due to missing config)
      expect(mockApp.listen).toHaveBeenCalled();
      const listenCall = mockApp.listen.mock.calls[0];
      expect(listenCall[0]).toBeDefined(); // Port should be defined
    });

    it('should handle component status with missing components', () => {
      // Clear all components
      (app as any).eventProcessor = null;
      (app as any).queueProcessor = null;
      (app as any).databaseConnection = null;
      (app as any).config = null;

      const status = app.getStatus();
      expect(status.components.config).toBe(false);
      expect(status.components.database).toBe(false);
      expect(status.components.eventProcessor).toBe(false);
      expect(status.components.queueProcessor).toBe(false);
    });

    it('should handle uptime calculation when not started', () => {
      const status = app.getStatus();
      expect(status.uptime).toBe(0);
      expect(status.startTime).toBeUndefined();
    });

    it('should handle graceful shutdown timeout', async () => {
      const shortTimeoutApp = new Application({
        configPath,
        enableHealthEndpoint: false,
        gracefulShutdownTimeout: 100 // Very short timeout
      });

      await shortTimeoutApp.start();

      // Mock components to delay shutdown
      const mockEventProcessor = (shortTimeoutApp as any).eventProcessor;
      mockEventProcessor.stop = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200)) // Longer than timeout
      );

      // Should complete shutdown even with timeout
      await shortTimeoutApp.stop();
      expect(shortTimeoutApp.getStatus().status).toBe('stopped');
    });
  });});
