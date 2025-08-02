import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { IEventListener } from './interfaces';
import { BlockchainConnection } from './BlockchainConnection';
import { EventSubscription, BlockchainEvent } from '../types';
import { NetworkConfig } from '../types/config';

export class EventListener extends EventEmitter implements IEventListener {
  private connection: BlockchainConnection;
  private subscriptions = new Map<string, EventSubscription>();
  private contractListeners = new Map<string, ethers.Contract>();
  private isRunning = false;

  constructor(networkConfig: NetworkConfig) {
    super();
    this.connection = new BlockchainConnection(networkConfig);
    this.setupConnectionEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      await this.connection.connect();
      this.isRunning = true;
      
      // Start monitoring all existing subscriptions
      await this.startAllSubscriptions();
      
      this.emit('started');
      console.log('EventListener started successfully');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // Stop all contract listeners
    await this.stopAllSubscriptions();
    
    // Disconnect from blockchain
    await this.connection.disconnect();
    
    this.emit('stopped');
    console.log('EventListener stopped');
  }

  addSubscription(subscription: EventSubscription): void {
    this.subscriptions.set(subscription.id, subscription);
    
    if (this.isRunning && this.connection.isConnected()) {
      this.startSubscription(subscription);
    }
    
    console.log(`Added subscription: ${subscription.id} for contract ${subscription.contractAddress}`);
  }

  removeSubscription(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`Subscription ${subscriptionId} not found`);
      return;
    }

    this.stopSubscription(subscriptionId);
    this.subscriptions.delete(subscriptionId);
    
    console.log(`Removed subscription: ${subscriptionId}`);
  }

  getSubscriptions(): EventSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  isListening(): boolean {
    return this.isRunning && this.connection.isConnected();
  }

  private setupConnectionEventHandlers(): void {
    this.connection.on('connected', async () => {
      console.log('Blockchain connection established');
      if (this.isRunning) {
        await this.startAllSubscriptions();
      }
    });

    this.connection.on('disconnected', () => {
      console.log('Blockchain connection lost');
      this.stopAllSubscriptions();
    });

    this.connection.on('error', (error: Error) => {
      console.error('Blockchain connection error:', error);
      this.emit('error', error);
    });

    this.connection.on('maxReconnectAttemptsReached', () => {
      console.error('Max reconnection attempts reached');
      this.emit('connectionFailed');
    });
  }

  private async startAllSubscriptions(): Promise<void> {
    const promises = Array.from(this.subscriptions.values()).map(subscription =>
      this.startSubscription(subscription)
    );
    
    await Promise.allSettled(promises);
  }

  private async stopAllSubscriptions(): Promise<void> {
    const subscriptionIds = Array.from(this.subscriptions.keys());
    
    for (const subscriptionId of subscriptionIds) {
      this.stopSubscription(subscriptionId);
    }
  }

  private async startSubscription(subscription: EventSubscription): Promise<void> {
    try {
      const provider = this.connection.getProvider();
      if (!provider) {
        throw new Error('Provider not available');
      }

      // Convert event signature string to proper ABI fragment
      const eventFragment = this.parseEventSignatureToABI(subscription.eventSignature);
      
      // Create contract instance with proper ABI
      const contract = new ethers.Contract(
        subscription.contractAddress,
        [eventFragment], // ABI with proper event fragment
        provider
      );

      // Parse event signature to get event name
      const eventName = this.parseEventName(subscription.eventSignature);
      
      // Set up event listener
      const listener = (...args: any[]) => {
        const event = args[args.length - 1]; // Last argument is the event object
        this.handleContractEvent(subscription, event, args.slice(0, -1));
      };

      contract.on(eventName, listener);
      
      // Store contract reference for cleanup
      this.contractListeners.set(subscription.id, contract);
      
      console.log(`Started monitoring ${eventName} events for contract ${subscription.contractAddress}`);
    } catch (error) {
      console.error(`Failed to start subscription ${subscription.id}:`, error);
      this.emit('subscriptionError', subscription.id, error);
    }
  }

  private stopSubscription(subscriptionId: string): void {
    const contract = this.contractListeners.get(subscriptionId);
    if (contract) {
      try {
        contract.removeAllListeners();
        this.contractListeners.delete(subscriptionId);
        console.log(`Stopped monitoring for subscription ${subscriptionId}`);
      } catch (error) {
        console.error(`Error stopping subscription ${subscriptionId}:`, error);
      }
    }
  }

  private handleContractEvent(
    subscription: EventSubscription,
    event: ethers.EventLog,
    args: any[]
  ): void {
    try {
      // Convert ethers event to our BlockchainEvent format
      const blockchainEvent: BlockchainEvent = {
        contractAddress: event.address.toLowerCase(),
        eventName: event.eventName || this.parseEventName(subscription.eventSignature),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        logIndex: event.index,
        args: this.parseEventArgs(subscription.eventSignature, args),
        timestamp: new Date()
      };

      // Emit the event for further processing
      this.emit('event', subscription, blockchainEvent);
      
      console.log(`Event detected: ${blockchainEvent.eventName} from ${blockchainEvent.contractAddress}`);
    } catch (error) {
      console.error('Error handling contract event:', error);
      this.emit('eventError', subscription.id, error);
    }
  }

  private parseEventName(eventSignature: string): string {
    // Extract event name from signature like "Transfer(address,address,uint256)"
    const match = eventSignature.match(/^(\w+)\(/);
    return match && match[1] ? match[1] : 'UnknownEvent';
  }

  private parseEventSignatureToABI(eventSignature: string): any {
    // Parse event signature like "Transfer(address,address,uint256)" into proper ABI fragment
    const match = eventSignature.match(/^(\w+)\(([^)]*)\)$/);
    if (!match) {
      throw new Error(`Invalid event signature: ${eventSignature}`);
    }

    const eventName = match[1];
    const paramString = match[2] || '';
    
    // Parse parameters
    const inputs: any[] = [];
    if (paramString.trim()) {
      const params = paramString.split(',').map(p => p.trim());
      params.forEach((param, index) => {
        // Handle different parameter formats:
        // - "address" -> {type: "address", name: `param${index}`, indexed: false}
        // - "address indexed from" -> {type: "address", name: "from", indexed: true}
        // - "address from" -> {type: "address", name: "from", indexed: false}
        
        const parts = param.split(/\s+/);
        const type = parts[0];
        let indexed = false;
        let name = `param${index}`;
        
        if (parts.length > 1) {
          if (parts[1] === 'indexed') {
            indexed = true;
            if (parts.length > 2 && parts[2]) {
              name = parts[2];
            }
          } else if (parts[1]) {
            name = parts[1];
          }
        }
        
        inputs.push({
          type,
          name,
          indexed
        });
      });
    }
    
    return {
      type: 'event',
      name: eventName,
      inputs
    };
  }

  private parseEventArgs(eventSignature: string, args: any[]): Record<string, any> {
    const result: Record<string, any> = {};

    // Always add indexed parameters
    args.forEach((value, index) => {
      result[index.toString()] = value;
    });

    // Parse parameter names from signature
    const match = eventSignature.match(/\(([^)]*)\)/);
    if (!match || !match[1]) {
      return result;
    }

    const paramTypes = match[1].split(',').map(param => param.trim());

    // Create named parameter mappings
    args.forEach((value, index) => {
      // Try to extract parameter name if available
      const paramType = paramTypes[index];
      if (paramType) {
        const paramMatch = paramType.match(/(\w+)\s+(\w+)$/);
        if (paramMatch && paramMatch[2]) {
          result[paramMatch[2]] = value; // Use parameter name
        } else {
          result[`param${index}`] = value; // Fallback to generic name
        }
      }
    });

    return result;
  }
}
