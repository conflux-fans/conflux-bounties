import { RetryScheduler } from '../RetryScheduler';
import type { WebhookDelivery } from '../../../types';

describe('RetryScheduler', () => {
  let scheduler: RetryScheduler;
  const mockDelivery: WebhookDelivery = {
    id: 'test-delivery-1',
    subscriptionId: 'sub-1',
    webhookId: 'webhook-1',
    event: {
      contractAddress: '0x123',
      eventName: 'Transfer',
      blockNumber: 100,
      transactionHash: '0xabc',
      logIndex: 0,
      args: { from: '0x456', to: '0x789', value: '1000' },
      timestamp: new Date()
    },
    payload: { test: 'data' },
    attempts: 0,
    maxAttempts: 3,
    status: 'pending'
  };

  beforeEach(() => {
    scheduler = new RetryScheduler(1000, 60000, 0); // No jitter for predictable tests
  });

  describe('constructor', () => {
    it('should use default values when no parameters provided', () => {
      const defaultScheduler = new RetryScheduler();
      
      // Test that defaults are applied by checking behavior (accounting for jitter)
      const delay0 = defaultScheduler.getBackoffDelay(0);
      expect(delay0).toBeGreaterThanOrEqual(1000); // default baseDelay
      expect(delay0).toBeLessThanOrEqual(1100); // default baseDelay + 10% jitter
      
      const delay20 = defaultScheduler.getBackoffDelay(20);
      expect(delay20).toBeLessThanOrEqual(330000); // should cap at default maxDelay + jitter
    });

    it('should use provided parameters', () => {
      const customScheduler = new RetryScheduler(2000, 120000, 0.2);
      
      const delay0 = customScheduler.getBackoffDelay(0);
      expect(delay0).toBeGreaterThanOrEqual(2000); // custom baseDelay
      expect(delay0).toBeLessThanOrEqual(2400); // custom baseDelay + 20% jitter
      
      const delay20 = customScheduler.getBackoffDelay(20);
      expect(delay20).toBeLessThanOrEqual(144000); // should cap at custom maxDelay + jitter
    });

    it('should handle jitter factor correctly', () => {
      const jitterScheduler = new RetryScheduler(1000, 60000, 0.1);
      const delay1 = jitterScheduler.getBackoffDelay(1);
      const delay2 = jitterScheduler.getBackoffDelay(1);
      
      // With jitter, delays should potentially be different
      // We can't guarantee they're different due to randomness, but we can check they're in expected range
      expect(delay1).toBeGreaterThanOrEqual(2000); // base delay
      expect(delay1).toBeLessThanOrEqual(2200); // base delay + 10% jitter
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2200);
    });
  });

  describe('calculateNextRetry', () => {
    it('should calculate exponential backoff delays', () => {
      const now = Date.now();
      
      const retry1 = scheduler.calculateNextRetry(1);
      const retry2 = scheduler.calculateNextRetry(2);
      const retry3 = scheduler.calculateNextRetry(3);

      expect(retry1.getTime()).toBeGreaterThan(now + 1900); // ~2 seconds
      expect(retry1.getTime()).toBeLessThan(now + 2100);
      
      expect(retry2.getTime()).toBeGreaterThan(now + 3900); // ~4 seconds
      expect(retry2.getTime()).toBeLessThan(now + 4100);
      
      expect(retry3.getTime()).toBeGreaterThan(now + 7900); // ~8 seconds
      expect(retry3.getTime()).toBeLessThan(now + 8100);
    });

    it('should respect maximum delay', () => {
      const shortMaxScheduler = new RetryScheduler(1000, 5000, 0);
      const now = Date.now();
      
      const retry10 = shortMaxScheduler.calculateNextRetry(10);
      
      expect(retry10.getTime()).toBeLessThan(now + 5100);
    });

    it('should use custom base delay when provided', () => {
      const now = Date.now();
      const customBase = 2000;
      
      const retry1 = scheduler.calculateNextRetry(1, customBase);
      
      expect(retry1.getTime()).toBeGreaterThan(now + 3900); // ~4 seconds (2000 * 2^1)
      expect(retry1.getTime()).toBeLessThan(now + 4100);
    });
  });

  describe('shouldRetry', () => {
    it('should return true when attempts are below max and status is not completed', () => {
      const delivery = { ...mockDelivery, attempts: 1, maxAttempts: 3, status: 'failed' as const };
      expect(scheduler.shouldRetry(delivery)).toBe(true);
    });

    it('should return false when attempts reach max', () => {
      const delivery = { ...mockDelivery, attempts: 3, maxAttempts: 3, status: 'failed' as const };
      expect(scheduler.shouldRetry(delivery)).toBe(false);
    });

    it('should return false when status is completed', () => {
      const delivery = { ...mockDelivery, attempts: 1, maxAttempts: 3, status: 'completed' as const };
      expect(scheduler.shouldRetry(delivery)).toBe(false);
    });
  });

  describe('getBackoffDelay', () => {
    it('should calculate exponential backoff correctly', () => {
      expect(scheduler.getBackoffDelay(0)).toBe(1000); // 1000 * 2^0
      expect(scheduler.getBackoffDelay(1)).toBe(2000); // 1000 * 2^1
      expect(scheduler.getBackoffDelay(2)).toBe(4000); // 1000 * 2^2
      expect(scheduler.getBackoffDelay(3)).toBe(8000); // 1000 * 2^3
    });

    it('should cap delay at maximum', () => {
      const shortMaxScheduler = new RetryScheduler(1000, 5000, 0);
      expect(shortMaxScheduler.getBackoffDelay(10)).toBe(5000);
    });

    it('should add jitter when configured', () => {
      const jitterScheduler = new RetryScheduler(1000, 60000, 0.1);
      const delay1 = jitterScheduler.getBackoffDelay(1);
      const delay2 = jitterScheduler.getBackoffDelay(1);
      
      // With jitter, delays should be different
      expect(delay1).not.toBe(delay2);
      expect(delay1).toBeGreaterThan(2000);
      expect(delay1).toBeLessThan(2200); // 2000 + 10% jitter
    });
  });

  describe('getDelayForAttempt', () => {
    it('should return the same as getBackoffDelay', () => {
      expect(scheduler.getDelayForAttempt(2)).toBe(scheduler.getBackoffDelay(2));
    });
  });

  describe('getMaxAttempts', () => {
    it('should calculate reasonable max attempts', () => {
      const maxAttempts = scheduler.getMaxAttempts();
      expect(maxAttempts).toBeGreaterThanOrEqual(5);
      expect(maxAttempts).toBeLessThan(20);
    });
  });
});