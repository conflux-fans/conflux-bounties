// Event listener interfaces
import type { EventSubscription, BlockchainEvent } from '../types';

export interface IEventListener {
  start(): Promise<void>;
  stop(): Promise<void>;
  addSubscription(subscription: EventSubscription): void;
  removeSubscription(subscriptionId: string): void;
}

export interface IBlockchainConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  onEvent(callback: (event: BlockchainEvent) => void): void;
}

export interface IContractMonitor {
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
  updateSubscription(subscription: EventSubscription): void;
}