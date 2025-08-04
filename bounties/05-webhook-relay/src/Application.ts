import { EventEmitter } from 'events';
import express from 'express';
import { Server } from 'http';

// Configuration
import { ConfigManager } from './config/ConfigManager';
import type { SystemConfig } from './types/config';

// Database
import { DatabaseConnection } from './database/connection';

// Components
import { EventListener } from './listeners/EventListener';
import { EventProcessor } from './listeners/EventProcessor';
import { BlockchainConnection } from './listeners/BlockchainConnection';
import { FilterEngine } from './filtering/FilterEngine';
import { DeliveryQueue } from './webhooks/queue/DeliveryQueue';

import { WebhookSender } from './webhooks/WebhookSender';
import { HttpClient } from './webhooks/HttpClient';

// Monitoring
import { HealthChecker } from './monitoring/HealthChecker';
import { Logger } from './monitoring/Logger';
import { MetricsCollector } from './monitoring/MetricsCollector';
import { DeliveryTracker } from './webhooks/DeliveryTracker';
import { QueueProcessor } from './webhooks/QueueProcessor';


export interface ApplicationOptions {
  configPath?: string;
  enableHealthEndpoint?: boolean;
  gracefulShutdownTimeout?: number;
}

export interface ApplicationStatus {
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  startTime?: Date | undefined;
  uptime: number;
  components: {
    config: boolean;
    database: boolean;
    eventProcessor: boolean;
    queueProcessor: boolean;
    healthChecker: boolean;
  };
}

/**
 * Main Application class that orchestrates all system components
 */
export class Application extends EventEmitter {
  private config: SystemConfig | null = null;
  private configManager: ConfigManager;
  private databaseConnection: DatabaseConnection | null = null;
  private logger: Logger;
  private metricsCollector: MetricsCollector;
  private healthChecker: HealthChecker;


  // Core components
  private blockchainConnection: BlockchainConnection | null = null;
  private eventListener: EventListener | null = null;
  private filterEngine: FilterEngine | null = null;
  private deliveryQueue: DeliveryQueue | null = null;
  private webhookSender: WebhookSender | null = null;
  private eventProcessor: EventProcessor | null = null;
  private queueProcessor: QueueProcessor | null = null;

  // HTTP server for health checks
  private healthServer: Server | null = null;

  private status: ApplicationStatus['status'] = 'stopped';
  private startTime: Date | null = null;
  private options: Required<ApplicationOptions>;
  private shutdownInProgress = false;
  private signalHandlers: Map<string, (...args: any[]) => void> = new Map();
  private processHandlers: { event: string; handler: (...args: any[]) => void }[] = [];

  constructor(options: ApplicationOptions = {}) {
    super();

    this.options = {
      configPath: options.configPath || 'config.json',
      enableHealthEndpoint: options.enableHealthEndpoint ?? true,
      gracefulShutdownTimeout: options.gracefulShutdownTimeout || 30000
    };

    // Initialize core monitoring components first
    this.logger = new Logger();
    this.metricsCollector = new MetricsCollector();
    this.healthChecker = new HealthChecker();

    // Initialize configuration manager
    this.configManager = new ConfigManager(this.options.configPath);

    this.setupSignalHandlers();
    this.setupConfigurationHandlers();
  }

  /**
   * Start the application
   */
  async start(): Promise<void> {
    if (this.status === 'running' || this.status === 'starting') {
      this.logger.warn('Application is already running or starting');
      return;
    }

    this.status = 'starting';
    this.startTime = new Date();
    this.emit('starting');

    try {
      this.logger.info('Starting Webhook Relay System', {
        configPath: this.options.configPath,
        enableHealthEndpoint: this.options.enableHealthEndpoint
      });

      // Step 1: Load and validate configuration
      await this.initializeConfiguration();

      // Step 2: Initialize database connection
      await this.initializeDatabase();

      // Step 3: Initialize core components
      await this.initializeComponents();

      // Step 4: Start health check server
      if (this.options.enableHealthEndpoint) {
        await this.startHealthServer();
      }

      // Step 5: Start event processing
      await this.startEventProcessing();

      // Step 6: Start queue processing
      await this.startQueueProcessing();

      this.status = 'running';
      this.emit('started');

      this.logger.info('Webhook Relay System started successfully', {
        uptime: this.getUptime(),
        components: this.getComponentStatus()
      });

    } catch (error) {
      this.status = 'error';
      this.emit('error', error);

      this.logger.error('Failed to start application', error as Error);

      // Attempt cleanup on startup failure
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop the application gracefully
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'stopping') {
      this.logger.warn('Application is already stopped or stopping');
      return;
    }

    if (this.shutdownInProgress) {
      this.logger.warn('Shutdown already in progress');
      return;
    }

    this.shutdownInProgress = true;
    this.status = 'stopping';
    this.emit('stopping');

    this.logger.info('Stopping Webhook Relay System gracefully');

    try {
      // Stop components in reverse order of startup
      await this.stopQueueProcessing();
      await this.stopEventProcessing();
      await this.stopHealthServer();
      await this.stopComponents();
      await this.closeDatabase();

      this.status = 'stopped';
      this.emit('stopped');

      this.logger.info('Webhook Relay System stopped successfully');

    } catch (error) {
      this.logger.error('Error during application shutdown', error as Error);
      this.emit('error', error);
    } finally {
      this.shutdownInProgress = false;
      // Clean up signal handlers
      this.removeSignalHandlers();
    }
  }

  /**
   * Check if application is running
   */
  isRunning(): boolean {
    return this.status === 'running';
  }

  /**
   * Get current application status
   */
  getStatus(): ApplicationStatus {
    return {
      status: this.status,
      startTime: this.startTime ?? undefined,
      uptime: this.getUptime(),
      components: this.getComponentStatus()
    };
  }

  /**
   * Get application uptime in seconds
   */
  private getUptime(): number {
    return this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;
  }

  /**
   * Get status of all components
   */
  private getComponentStatus() {
    return {
      config: this.config !== null,
      database: this.databaseConnection !== null,
      eventProcessor: this.eventProcessor !== null && this.eventProcessor.isProcessing(),
      queueProcessor: this.queueProcessor !== null && this.queueProcessor.isRunning(),
      healthChecker: this.healthChecker !== null
    };
  }

  /**
   * Initialize configuration
   */
  private async initializeConfiguration(): Promise<void> {
    this.logger.info('Loading configuration', { configPath: this.options.configPath });

    try {
      this.config = await this.configManager.loadConfig();

      // Update logger level based on configuration
      this.logger.setLevel(this.config.monitoring.logLevel);

      this.logger.info('Configuration loaded successfully', {
        subscriptions: this.config.subscriptions.length,
        logLevel: this.config.monitoring.logLevel,
        metricsEnabled: this.config.monitoring.metricsEnabled
      });

    } catch (error) {
      throw new Error(`Configuration initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    this.logger.info('Initializing database connection');

    try {
      this.databaseConnection = new DatabaseConnection(this.config.database);

      // Test database connection
      const isHealthy = await this.databaseConnection.healthCheck();
      if (!isHealthy) {
        throw new Error('Database health check failed');
      }

      // Register database health check
      this.healthChecker.registerDatabaseHealthCheck(this.databaseConnection['pool']);

      this.logger.info('Database connection initialized successfully');

    } catch (error) {
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize all core components
   */
  private async initializeComponents(): Promise<void> {
    if (!this.config || !this.databaseConnection) {
      throw new Error('Prerequisites not initialized');
    }

    this.logger.info('Initializing core components');

    try {
      // Initialize blockchain connection
      this.blockchainConnection = new BlockchainConnection(this.config.network);

      // Initialize filter engine
      this.filterEngine = new FilterEngine();

      // Initialize queue components
      this.deliveryQueue = new DeliveryQueue(this.databaseConnection);

      // Initialize webhook sender components
      const httpClient = new HttpClient();
      const deliveryTracker = new DeliveryTracker();
      this.webhookSender = new WebhookSender(httpClient, deliveryTracker);

      // Initialize event listener
      this.eventListener = new EventListener(this.config.network);

      // Initialize processors
      this.eventProcessor = new EventProcessor(
        this.eventListener,
        this.filterEngine,
        this.databaseConnection,
        this.deliveryQueue
      );

      this.queueProcessor = new QueueProcessor(
        this.deliveryQueue,
        this.webhookSender,
        this.logger,
        {
          maxConcurrentDeliveries: this.config.options.maxConcurrentWebhooks,
          processingInterval: this.config.options.queueProcessingInterval
        }
      );

      this.logger.info('Core components initialized successfully');

    } catch (error) {
      throw new Error(`Component initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start health check HTTP server
   */
  private async startHealthServer(): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    const app = express();

    // Health check endpoint
    app.get('/health', async (_req, res) => {
      try {
        const healthStatus = await this.healthChecker.checkHealth();
        const statusCode = healthStatus.status === 'healthy' ? 200 :
          healthStatus.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json({
          ...healthStatus,
          application: this.getStatus()
        });
      } catch (error) {
        res.status(500).json({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    });

    // Metrics endpoint (if enabled)
    if (this.config.monitoring.metricsEnabled) {
      app.get('/metrics', async (_req, res) => {
        try {
          const metrics = await this.metricsCollector.getMetrics();
          res.json(metrics);
        } catch (error) {
          res.status(500).json({
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    }

    return new Promise((resolve, reject) => {
      this.healthServer = app.listen(this.config!.monitoring.healthCheckPort, (error?: Error) => {
        if (error) {
          reject(new Error(`Failed to start health server: ${error.message}`));
        } else {
          this.logger.info('Health check server started', {
            port: this.config!.monitoring.healthCheckPort
          });
          resolve();
        }
      });
    });
  }

  /**
   * Start event processing
   */
  private async startEventProcessing(): Promise<void> {
    if (!this.eventProcessor || !this.config) {
      throw new Error('Event processor not initialized');
    }

    this.logger.info('Starting event processing');

    try {
      // Add subscriptions from configuration
      for (const subscription of this.config.subscriptions) {
        this.eventProcessor.addSubscription(subscription);
      }

      await this.eventProcessor.start();

      this.logger.info('Event processing started', {
        subscriptions: this.config.subscriptions.length
      });

    } catch (error) {
      throw new Error(`Failed to start event processing: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Start queue processing
   */
  private async startQueueProcessing(): Promise<void> {
    if (!this.queueProcessor) {
      throw new Error('Queue processor not initialized');
    }

    this.logger.info('Starting queue processing');

    try {
      // Note: Queue processing is not needed since EventListener handles webhook delivery directly
      this.logger.info('Queue processing skipped - using direct webhook delivery');
    } catch (error) {
      throw new Error(`Failed to start queue processing: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stop queue processing
   */
  private async stopQueueProcessing(): Promise<void> {
    if (this.queueProcessor) {
      this.logger.info('Stopping queue processing');
      try {
        await this.queueProcessor.stop();
        this.logger.info('Queue processing stopped');
      } catch (error) {
        this.logger.error('Error stopping queue processing', error as Error);
      }
    }
  }

  /**
   * Stop event processing
   */
  private async stopEventProcessing(): Promise<void> {
    if (this.eventProcessor) {
      this.logger.info('Stopping event processing');
      try {
        await this.eventProcessor.stop();
        this.logger.info('Event processing stopped');
      } catch (error) {
        this.logger.error('Error stopping event processing', error as Error);
      }
    }
  }

  /**
   * Stop health server
   */
  private async stopHealthServer(): Promise<void> {
    if (this.healthServer) {
      this.logger.info('Stopping health server');
      return new Promise((resolve) => {
        this.healthServer!.close(() => {
          this.logger.info('Health server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * Stop all components
   */
  private async stopComponents(): Promise<void> {
    this.logger.info('Stopping components');

    // Stop blockchain connection
    if (this.blockchainConnection) {
      try {
        await this.blockchainConnection.disconnect();
      } catch (error) {
        this.logger.error('Error stopping blockchain connection', error as Error);
      }
    }
  }

  /**
   * Close database connection
   */
  private async closeDatabase(): Promise<void> {
    if (this.databaseConnection) {
      this.logger.info('Closing database connection');
      try {
        await this.databaseConnection.close();
        this.logger.info('Database connection closed');
      } catch (error) {
        this.logger.error('Error closing database connection', error as Error);
      }
    }
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    await this.stopQueueProcessing();
    await this.stopEventProcessing();
    await this.stopHealthServer();
    await this.stopComponents();
    await this.closeDatabase();
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Skip signal handlers in test environment to prevent worker crashes
    if (process.env['NODE_ENV'] === 'test') {
      return;
    }

    const signals: string[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    signals.forEach(signal => {
      const handler = async () => {
        console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
        this.logger.info(`Received ${signal}, initiating graceful shutdown`);

        // Display final status before shutdown
        if (this.eventProcessor) {
          try {
            console.log('\n📊 Final Status Report:');
            this.eventProcessor.displayProcessorStatus();
          } catch (error) {
            console.log('Could not display final status:', error);
          }
        }

        // Set a timeout for graceful shutdown
        const shutdownTimeout = setTimeout(() => {
          console.log('⚠️ Graceful shutdown timeout, forcing exit');
          this.logger.error('Graceful shutdown timeout, forcing exit');
          process.exit(1);
        }, this.options.gracefulShutdownTimeout);

        try {
          await this.stop();
          clearTimeout(shutdownTimeout);
          console.log('✅ Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.log('❌ Error during graceful shutdown:', error);
          this.logger.error('Error during graceful shutdown', error as Error);
          clearTimeout(shutdownTimeout);
          process.exit(1);
        }
      };

      process.on(signal, handler);
      this.signalHandlers.set(signal, handler);
    });

    // Handle uncaught exceptions
    const uncaughtExceptionHandler = (error: Error) => {
      this.logger.error('Uncaught exception', error);
      process.exit(1);
    };
    process.on('uncaughtException', uncaughtExceptionHandler);
    this.processHandlers.push({ event: 'uncaughtException', handler: uncaughtExceptionHandler });

    // Handle unhandled promise rejections
    const unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled promise rejection', new Error(String(reason)), {
        promise: promise.toString()
      });
      process.exit(1);
    };
    process.on('unhandledRejection', unhandledRejectionHandler);
    this.processHandlers.push({ event: 'unhandledRejection', handler: unhandledRejectionHandler });
  }

  /**
   * Remove signal handlers (useful for testing)
   */
  private removeSignalHandlers(): void {
    // Remove signal handlers
    for (const [signal, handler] of this.signalHandlers.entries()) {
      process.removeListener(signal, handler);
    }
    this.signalHandlers.clear();

    // Remove process handlers
    for (const { event, handler } of this.processHandlers) {
      process.removeListener(event as any, handler);
    }
    this.processHandlers = [];
  }

  /**
   * Setup configuration change handlers
   */
  private setupConfigurationHandlers(): void {
    this.configManager.onConfigChange(async (newConfig) => {
      this.logger.info('Configuration changed, reloading components');

      try {
        // Update configuration
        this.config = newConfig;

        // Update logger level
        this.logger.setLevel(newConfig.monitoring.logLevel);

        // Reload subscriptions in event processor
        if (this.eventProcessor) {
          // Remove existing subscriptions
          const currentSubscriptions = this.eventProcessor.getSubscriptions();
          for (const subscription of currentSubscriptions) {
            this.eventProcessor.removeSubscription(subscription.id);
          }

          // Add new subscriptions
          for (const subscription of newConfig.subscriptions) {
            this.eventProcessor.addSubscription(subscription);
          }
        }

        this.emit('configReloaded', newConfig);
        this.logger.info('Configuration reloaded successfully');

      } catch (error) {
        this.logger.error('Error reloading configuration', error as Error);
        this.emit('configReloadError', error);
      }
    });

    this.configManager.on('error', (error) => {
      this.logger.error('Configuration manager error', error);
      this.emit('configError', error);
    });
  }
}