import { EventEmitter } from 'events';
import type { EventListener } from './EventListener';
import type { FilterEngine } from '../filtering/FilterEngine';
import type { DatabaseConnection } from '../database/connection';
import type { IDeliveryQueue } from '../webhooks/queue/interfaces';
import type {
  EventSubscription,
  BlockchainEvent,
  WebhookDelivery
} from '../types';
import { createFormatter } from '../formatting';
import type { WebhookConfig } from '../types/common';
import { v4 as uuidv4 } from 'uuid';

export interface IEventProcessor {
  start(): Promise<void>;
  stop(): Promise<void>;
  addSubscription(subscription: EventSubscription): Promise<void>;
  removeSubscription(subscriptionId: string): void;
  getSubscriptions(): EventSubscription[];
  isProcessing(): boolean;
}

/**
 * EventProcessor integrates EventListener with FilterEngine and DeliveryQueue
 * to create a complete event processing pipeline
 */
export class EventProcessor extends EventEmitter implements IEventProcessor {
  private eventListener: EventListener;
  private filterEngine: FilterEngine;
  private database: DatabaseConnection;
  private deliveryQueue: IDeliveryQueue;
  private subscriptions = new Map<string, EventSubscription>();
  private isRunning = false;

  // Enhanced monitoring capabilities
  private startTime = Date.now();
  private processedEvents = 0;
  private filteredEvents = 0;
  private statusInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    eventListener: EventListener,
    filterEngine: FilterEngine,
    database: DatabaseConnection,
    deliveryQueue: IDeliveryQueue
  ) {
    super();
    this.eventListener = eventListener;
    this.filterEngine = filterEngine;
    this.database = database;
    this.deliveryQueue = deliveryQueue;

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    let startTimeoutHandle: NodeJS.Timeout | null = null;

    try {
      // Start the event listener with timeout
      const startTimeout = new Promise<never>((_, reject) => {
        startTimeoutHandle = setTimeout(() => reject(new Error('EventProcessor start timeout')), 10000);
      });

      const startPromise = this.eventListener.start().finally(() => {
        if (startTimeoutHandle) {
          clearTimeout(startTimeoutHandle);
          startTimeoutHandle = null;
        }
      });

      await Promise.race([
        startPromise,
        startTimeout
      ]);

      this.isRunning = true;
      this.startTime = Date.now();

      // Start periodic status display only in non-test environments
      if (process.env['NODE_ENV'] !== 'test') {
        this.statusInterval = setInterval(() => {
          this.displayProcessorStatus();
        }, 60000); // Every minute
      }

      this.emit('started');
      console.log('🚀 EventProcessor started successfully - Real-time processing active!');
    } catch (error) {
      // Cleanup on error
      this.isRunning = false;
      if (startTimeoutHandle) {
        clearTimeout(startTimeoutHandle);
        startTimeoutHandle = null;
      }
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = null;
      }
      this.emit('error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      console.log('\n🛑 Stopping EventProcessor...');

      // Stop status display first to prevent hanging
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
        this.statusInterval = null;
      }

      // Stop event listener
      await this.eventListener.stop();

      // Remove all listeners to prevent memory leaks
      this.removeAllListeners();

      this.isRunning = false;
      this.emit('stopped');
      console.log('✅ EventProcessor stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async addSubscription(subscription: EventSubscription): Promise<void> {
    // Validate subscription
    if (!subscription.id || !subscription.contractAddress || !subscription.eventSignature) {
      throw new Error('Invalid subscription: missing required fields');
    }

    // Store subscription locally
    this.subscriptions.set(subscription.id, subscription);

    try {
      // Persist subscription to database (synchronously)
      await this.persistSubscription(subscription);

      // Persist webhooks to database (synchronously)
      await this.persistWebhooks(subscription);

      // Add to event listener only after database persistence is complete
      this.eventListener.addSubscription(subscription);

      this.emit('subscriptionAdded', subscription);
      console.log(`✅ Successfully added subscription ${subscription.id} with ${subscription.webhooks.length} webhooks`);

    } catch (error) {
      // Remove from local storage if database persistence failed
      this.subscriptions.delete(subscription.id);
      console.error(`❌ Failed to add subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  removeSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`Subscription ${subscriptionId} not found`);
      return;
    }

    // Remove from local storage
    this.subscriptions.delete(subscriptionId);

    // Remove from event listener
    this.eventListener.removeSubscription(subscriptionId);

    this.emit('subscriptionRemoved', subscriptionId);
    console.log(`Removed subscription: ${subscriptionId}`);
  }

  /**
   * Persist subscription to database
   */
  private async persistSubscription(subscription: EventSubscription): Promise<void> {
    try {
      // Normalize to arrays for consistent storage
      const contractAddresses = Array.isArray(subscription.contractAddress)
        ? subscription.contractAddress
        : [subscription.contractAddress];

      const eventSignatures = Array.isArray(subscription.eventSignature)
        ? subscription.eventSignature
        : [subscription.eventSignature];

      // Check if subscription already exists
      const existingResult = await this.database.query(
        'SELECT id FROM subscriptions WHERE id = $1',
        [subscription.id]
      );

      if (existingResult.rows.length > 0) {
        console.log(`Subscription ${subscription.id} already exists in database`);
        return;
      }

      // Insert subscription into database with arrays stored as JSONB
      await this.database.query(`
        INSERT INTO subscriptions (id, name, contract_address, event_signature, filters, active)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        subscription.id,
        subscription.id, // Use ID as name for now
        JSON.stringify(contractAddresses),
        JSON.stringify(eventSignatures),
        JSON.stringify(subscription.filters || {}),
        true
      ]);

      console.log(`✅ Persisted subscription ${subscription.id} to database with ${contractAddresses.length} contract(s) and ${eventSignatures.length} event(s)`);

    } catch (error) {
      console.error(`❌ Failed to persist subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  /**
   * Persist webhooks to database
   */
  private async persistWebhooks(subscription: EventSubscription): Promise<void> {
    try {
      for (const webhook of subscription.webhooks) {
        // Use INSERT ... ON CONFLICT to handle existing webhooks gracefully
        await this.database.query(`
          INSERT INTO webhooks (id, subscription_id, url, format, headers, timeout, retry_attempts, active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (id) DO UPDATE SET
            subscription_id = EXCLUDED.subscription_id,
            url = EXCLUDED.url,
            format = EXCLUDED.format,
            headers = EXCLUDED.headers,
            timeout = EXCLUDED.timeout,
            retry_attempts = EXCLUDED.retry_attempts,
            active = EXCLUDED.active
        `, [
          webhook.id,
          subscription.id,
          webhook.url,
          webhook.format,
          JSON.stringify(webhook.headers || {}),
          webhook.timeout || 30000,
          webhook.retryAttempts || 3,
          true
        ]);

        console.log(`✅ Persisted webhook ${webhook.id} to database`);
      }

    } catch (error) {
      console.error(`❌ Failed to persist webhooks for subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Load subscriptions from database
   */
  async loadSubscriptionsFromDatabase(): Promise<void> {
    if (!this.database) {
      console.warn('Database not available, skipping subscription loading');
      return;
    }

    try {
      const result = await this.database.query(`
        SELECT id, name, contract_address, event_signature, filters, active
        FROM subscriptions
        WHERE active = true
      `);

      console.log(`Loading ${result.rows.length} subscription(s) from database`);

      for (const row of result.rows) {
        try {
          // Parse JSON arrays from database
          const contractAddresses = JSON.parse(row.contract_address);
          const eventSignatures = JSON.parse(row.event_signature);
          const filters = JSON.parse(row.filters || '{}');

          // Create subscription object
          const subscription: EventSubscription = {
            id: row.id,
            contractAddress: contractAddresses,
            eventSignature: eventSignatures,
            filters,
            webhooks: [] // Webhooks will be loaded separately
          };

          // Load webhooks for this subscription
          const webhookResult = await this.database.query(`
            SELECT id, url, format, headers, timeout, retry_attempts
            FROM webhooks
            WHERE subscription_id = $1 AND active = true
          `, [subscription.id]);

          subscription.webhooks = webhookResult.rows.map((webhookRow: any) => ({
            id: webhookRow.id,
            url: webhookRow.url,
            format: webhookRow.format,
            headers: JSON.parse(webhookRow.headers || '{}'),
            timeout: webhookRow.timeout,
            retryAttempts: webhookRow.retry_attempts
          }));

          // Add subscription to EventListener
          this.eventListener.addSubscription(subscription);
          this.subscriptions.set(subscription.id, subscription);

          console.log(`✅ Loaded subscription ${subscription.id} with ${contractAddresses.length} contract(s), ${eventSignatures.length} event(s), and ${subscription.webhooks.length} webhook(s)`);

        } catch (parseError) {
          console.error(`Failed to parse subscription ${row.id}:`, parseError);
        }
      }

    } catch (error) {
      console.error('Failed to load subscriptions from database:', error);
      throw error;
    }
  }

  isProcessing(): boolean {
    return this.isRunning && this.eventListener.isListening();
  }

  /**
   * Get processing statistics
   */
  async getStats() {
    const eventStats = this.eventListener.getEventStatistics();
    const queueStats = await this.deliveryQueue.getStats();
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      isProcessing: this.isProcessing(),
      subscriptionCount: this.subscriptions.size,
      uptime,
      processedEvents: this.processedEvents,
      filteredEvents: this.filteredEvents,
      eventStats,
      queueStats
    };
  }

  /**
   * Display comprehensive processor status
   */
  displayProcessorStatus(): void {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(uptime / 60);
    const seconds = uptime % 60;

    console.log(`\n📊 EventProcessor Status Report:`);
    console.log(`   ⏰ Uptime: ${minutes}m ${seconds}s`);
    console.log(`   📋 Active subscriptions: ${this.subscriptions.size}`);
    console.log(`   🎯 Events processed: ${this.processedEvents}`);
    console.log(`   📊 Events filtered: ${this.filteredEvents}`);

    // Display event listener status
    this.eventListener.displayEventStatus();
  }

  private setupEventHandlers(): void {
    // Handle events from EventListener
    this.eventListener.on('event', this.handleBlockchainEvent.bind(this));

    // Forward EventListener events
    this.eventListener.on('started', () => this.emit('listenerStarted'));
    this.eventListener.on('stopped', () => this.emit('listenerStopped'));
    this.eventListener.on('error', (error) => this.emit('listenerError', error));
    this.eventListener.on('connectionFailed', () => this.emit('connectionFailed'));
    this.eventListener.on('subscriptionError', (subscriptionId, error) =>
      this.emit('subscriptionError', subscriptionId, error));
    this.eventListener.on('eventError', (subscriptionId, error) =>
      this.emit('eventError', subscriptionId, error));
  }

  /**
   * Handle blockchain events from EventListener
   */
  private async handleBlockchainEvent(
    subscription: EventSubscription,
    event: BlockchainEvent
  ): Promise<void> {
    try {
      this.processedEvents++;
      console.log(`🔄 Processing event: ${event.eventName} from ${event.contractAddress}`);

      // Apply filters using FilterEngine BEFORE processing webhooks
      const matchesFilter = this.filterEngine.evaluateFilters(event, subscription.filters);

      if (!matchesFilter) {
        this.filteredEvents++;
        console.log(`📊 Event filtered out for subscription ${subscription.id}`);
        this.emit('eventFiltered', subscription.id, event);
        return;
      }

      console.log(`✅ Event matches filters for subscription ${subscription.id}`);
      this.emit('eventMatched', subscription.id, event);

      // Process each webhook that matches the filter
      await this.processMatchingWebhooks(subscription, event);

    } catch (error) {
      console.error(`❌ Error processing event for subscription ${subscription.id}:`, error);
      this.emit('processingError', subscription.id, event, error);
    }
  }

  /**
   * Process webhooks for events that match filters
   */
  private async processMatchingWebhooks(
    subscription: EventSubscription,
    event: BlockchainEvent
  ): Promise<void> {
    // Create WebhookDelivery objects for each webhook in the subscription
    const deliveryPromises = subscription.webhooks.map(async (webhook) => {
      try {
        // Apply platform-specific formatting before enqueueing
        const formattedPayload = await this.formatPayloadForWebhook(event, webhook);

        const webhookDelivery: WebhookDelivery = {
          id: uuidv4(),
          subscriptionId: subscription.id,
          webhookId: webhook.id,
          event: event,
          payload: formattedPayload,
          attempts: 0,
          maxAttempts: webhook.retryAttempts || 3,
          status: 'pending' // Enqueue with 'pending' status
        };

        // Enqueue the webhook delivery for processing
        await this.deliveryQueue.enqueue(webhookDelivery);
        console.log(`📤 Enqueued webhook delivery ${webhookDelivery.id} for webhook ${webhook.id} with ${webhook.format} format`);
      } catch (error) {
        console.error(`❌ Error creating webhook delivery for webhook ${webhook.id}:`, error);
        throw error;
      }
    });

    // Wait for all deliveries to be created
    const results = await Promise.allSettled(deliveryPromises);

    // Check if any deliveries failed
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      const firstFailure = failures[0] as PromiseRejectedResult;
      throw firstFailure.reason;
    }
  }

  /**
   * Format payload using platform-specific formatter
   */
  private async formatPayloadForWebhook(
    event: BlockchainEvent,
    webhook: WebhookConfig
  ): Promise<any> {
    try {
      // Create appropriate formatter based on webhook format
      const formatter = createFormatter(webhook.format);
      
      // Format the payload using the platform-specific formatter
      const formattedPayload = formatter.formatPayload(event);
      
      console.log(`✅ Formatted payload for ${webhook.format} format`);
      return formattedPayload;
    } catch (error) {
      console.error(`❌ Error formatting payload for webhook ${webhook.id} with format ${webhook.format}:`, error);
      
      // Fallback to generic format if platform-specific formatting fails
      const genericFormatter = createFormatter('generic');
      return genericFormatter.formatPayload(event);
    }
  }






}