import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { EventListener } from './EventListener';
import type { FilterEngine } from '../filtering/FilterEngine';
import type { DeliveryQueue } from '../webhooks/queue/DeliveryQueue';
import type { 
  EventSubscription, 
  BlockchainEvent, 
  WebhookDelivery,
  WebhookConfig 
} from '../types';

export interface IEventProcessor {
  start(): Promise<void>;
  stop(): Promise<void>;
  addSubscription(subscription: EventSubscription): void;
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
  private deliveryQueue: DeliveryQueue;
  private subscriptions = new Map<string, EventSubscription>();
  private isRunning = false;

  constructor(
    eventListener: EventListener,
    filterEngine: FilterEngine,
    deliveryQueue: DeliveryQueue
  ) {
    super();
    this.eventListener = eventListener;
    this.filterEngine = filterEngine;
    this.deliveryQueue = deliveryQueue;

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // Start the event listener
      await this.eventListener.start();
      
      // Start queue processing with our webhook processor
      this.deliveryQueue.startProcessing(this.processWebhookDelivery.bind(this));
      
      this.isRunning = true;
      this.emit('started');
      console.log('EventProcessor started successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop queue processing
      this.deliveryQueue.stopProcessing();
      
      // Stop event listener
      await this.eventListener.stop();
      
      this.isRunning = false;
      this.emit('stopped');
      console.log('EventProcessor stopped');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  addSubscription(subscription: EventSubscription): void {
    // Validate subscription
    if (!subscription.id || !subscription.contractAddress || !subscription.eventSignature) {
      throw new Error('Invalid subscription: missing required fields');
    }

    // Store subscription locally
    this.subscriptions.set(subscription.id, subscription);
    
    // Add to event listener
    this.eventListener.addSubscription(subscription);
    
    this.emit('subscriptionAdded', subscription);
    console.log(`Added subscription: ${subscription.id} for contract ${subscription.contractAddress}`);
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

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  isProcessing(): boolean {
    return this.isRunning && this.eventListener.isListening();
  }

  /**
   * Get processing statistics
   */
  async getStats() {
    const queueStats = await this.deliveryQueue.getStats();
    return {
      isProcessing: this.isProcessing(),
      subscriptionCount: this.subscriptions.size,
      queueStats
    };
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
      console.log(`Processing event: ${event.eventName} from ${event.contractAddress}`);
      
      // Apply filters using FilterEngine
      const matchesFilter = this.filterEngine.evaluateFilters(event, subscription.filters);
      
      if (!matchesFilter) {
        console.log(`Event filtered out for subscription ${subscription.id}`);
        this.emit('eventFiltered', subscription.id, event);
        return;
      }

      console.log(`Event matches filters for subscription ${subscription.id}`);
      this.emit('eventMatched', subscription.id, event);

      // Create webhook deliveries for each webhook in the subscription
      await this.createWebhookDeliveries(subscription, event);
      
    } catch (error) {
      console.error(`Error processing event for subscription ${subscription.id}:`, error);
      this.emit('processingError', subscription.id, event, error);
    }
  }

  /**
   * Create webhook deliveries for all webhooks in a subscription
   */
  private async createWebhookDeliveries(
    subscription: EventSubscription,
    event: BlockchainEvent
  ): Promise<void> {
    const deliveryPromises = subscription.webhooks.map(webhook => 
      this.createWebhookDelivery(subscription, webhook, event)
    );

    try {
      await Promise.allSettled(deliveryPromises);
    } catch (error) {
      console.error(`Error creating webhook deliveries for subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  /**
   * Create a single webhook delivery and enqueue it
   */
  private async createWebhookDelivery(
    subscription: EventSubscription,
    webhook: WebhookConfig,
    event: BlockchainEvent
  ): Promise<void> {
    try {
      const delivery: WebhookDelivery = {
        id: uuidv4(),
        subscriptionId: subscription.id,
        webhookId: webhook.id,
        event,
        payload: event, // Will be formatted by the webhook sender
        attempts: 0,
        maxAttempts: webhook.retryAttempts || 3,
        status: 'pending'
      };

      await this.deliveryQueue.enqueue(delivery);
      
      console.log(`Enqueued webhook delivery ${delivery.id} for webhook ${webhook.id}`);
      this.emit('deliveryEnqueued', delivery);
      
    } catch (error) {
      console.error(`Error creating webhook delivery for webhook ${webhook.id}:`, error);
      this.emit('deliveryError', webhook.id, error);
      throw error;
    }
  }

  /**
   * Process webhook delivery (called by DeliveryQueue)
   * This is a placeholder - actual webhook sending will be implemented in task 11
   */
  private async processWebhookDelivery(delivery: WebhookDelivery): Promise<void> {
    console.log(`Processing webhook delivery ${delivery.id}`);
    
    // For now, we'll just simulate processing
    // In task 11, this will integrate with WebhookSender
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Emit event for monitoring
    this.emit('deliveryProcessed', delivery);
    
    console.log(`Completed webhook delivery ${delivery.id}`);
  }
}