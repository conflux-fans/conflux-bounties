// Queue management interfaces
import type { WebhookDelivery } from '../../types';

export interface IDeliveryQueue {
  enqueue(delivery: WebhookDelivery): Promise<void>;
  dequeue(): Promise<WebhookDelivery | null>;
  markComplete(deliveryId: string): Promise<void>;
  markFailed(deliveryId: string, error: string): Promise<void>;
  scheduleRetry(deliveryId: string, retryAt: Date): Promise<void>;
  getQueueSize(): Promise<number>;
  getProcessingCount(): Promise<number>;
}

export interface IRetryScheduler {
  calculateNextRetry(attempt: number, baseDelay?: number): Date;
  shouldRetry(delivery: WebhookDelivery): boolean;
  getBackoffDelay(attempt: number): number;
}

export interface IQueuePersistence {
  saveDelivery(delivery: WebhookDelivery): Promise<void>;
  getNextDelivery(): Promise<WebhookDelivery | null>;
  updateDeliveryStatus(deliveryId: string, status: string, error?: string): Promise<void>;
  updateRetrySchedule(deliveryId: string, nextRetry: Date, attempts: number): Promise<void>;
  getQueueMetrics(): Promise<QueueMetrics>;
  cleanupCompletedDeliveries(olderThan: Date): Promise<number>;
  resetStuckDeliveries(stuckThreshold: number): Promise<number>;
}

export interface QueueMetrics {
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
}

export interface QueueProcessorOptions {
  maxConcurrentDeliveries: number;
  processingInterval: number;
  retryBaseDelay: number;
  maxRetryDelay: number;
  cleanupInterval: number;
  cleanupAge: number; // in hours
}