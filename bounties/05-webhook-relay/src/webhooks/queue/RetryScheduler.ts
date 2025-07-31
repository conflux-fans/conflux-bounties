import type { WebhookDelivery } from '../../types';
import type { IRetryScheduler } from './interfaces';

export class RetryScheduler implements IRetryScheduler {
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly jitterFactor: number;

  constructor(
    baseDelay: number = 1000, // 1 second
    maxDelay: number = 300000, // 5 minutes
    jitterFactor: number = 0.1 // 10% jitter
  ) {
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.jitterFactor = jitterFactor;
  }

  calculateNextRetry(attempt: number, baseDelay?: number): Date {
    const delay = this.getBackoffDelay(attempt, baseDelay);
    return new Date(Date.now() + delay);
  }

  shouldRetry(delivery: WebhookDelivery): boolean {
    return delivery.attempts < delivery.maxAttempts && 
           delivery.status !== 'completed';
  }

  getBackoffDelay(attempt: number, customBaseDelay?: number): number {
    const base = customBaseDelay || this.baseDelay;
    
    // Exponential backoff: base * 2^attempt
    let delay = base * Math.pow(2, attempt);
    
    // Cap at maximum delay
    delay = Math.min(delay, this.maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = delay * this.jitterFactor * Math.random();
    delay += jitter;
    
    return Math.floor(delay);
  }

  /**
   * Calculate delay for a specific attempt number
   * Useful for testing and debugging
   */
  getDelayForAttempt(attempt: number): number {
    return this.getBackoffDelay(attempt);
  }

  /**
   * Get the maximum number of attempts before giving up
   */
  getMaxAttempts(): number {
    // Calculate how many attempts it takes to reach max delay
    let attempt = 0;
    while (this.baseDelay * Math.pow(2, attempt) < this.maxDelay) {
      attempt++;
    }
    return Math.max(attempt + 2, 5); // At least 5 attempts
  }
}