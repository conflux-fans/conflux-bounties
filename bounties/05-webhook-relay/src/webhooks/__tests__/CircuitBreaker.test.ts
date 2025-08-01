import { CircuitBreaker, CircuitState } from '../CircuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeout: 1000,
      monitoringWindow: 5000
    });
  });

  describe('initial state', () => {
    it('should start in closed state', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    it('should have zero failure and success counts', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });
  });

  describe('closed state behavior', () => {
    it('should allow execution when closed', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('should record successes', () => {
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.getStats().successCount).toBe(1);
    });

    it('should record failures', () => {
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getStats().failureCount).toBe(1);
    });

    it('should open circuit when failure threshold is reached', () => {
      // Record failures up to threshold
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
      expect(circuitBreaker.canExecute()).toBe(false);
    });
  });

  describe('open state behavior', () => {
    beforeEach(() => {
      // Force circuit to open
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
    });

    it('should not allow execution when open', () => {
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('should transition to half-open after reset timeout', async () => {
      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);
    });

    it('should have next attempt time set', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.nextAttemptTime).toBeDefined();
      expect(stats.nextAttemptTime!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('half-open state behavior', () => {
    beforeEach(async () => {
      // Force circuit to open and wait for reset timeout
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      await new Promise(resolve => setTimeout(resolve, 1100));
      circuitBreaker.canExecute(); // This transitions to half-open
    });

    it('should allow execution when half-open', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('should close circuit on successful attempt', () => {
      circuitBreaker.recordSuccess();
      
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getStats().failureCount).toBe(0);
    });

    it('should open circuit on failed attempt', () => {
      circuitBreaker.recordFailure();
      
      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
      expect(circuitBreaker.canExecute()).toBe(false);
    });
  });

  describe('reset functionality', () => {
    it('should reset all counters and state', () => {
      circuitBreaker.recordFailure();
      circuitBreaker.recordSuccess();
      
      circuitBreaker.reset();
      
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.lastFailureTime).toBeUndefined();
      expect(stats.nextAttemptTime).toBeUndefined();
    });
  });

  describe('force open functionality', () => {
    it('should force circuit to open state', () => {
      circuitBreaker.forceOpen();
      
      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
      expect(circuitBreaker.canExecute()).toBe(false);
    });
  });

  describe('monitoring window cleanup', () => {
    it('should clean up old failures outside monitoring window', async () => {
      // Create circuit breaker with short monitoring window
      const shortWindowBreaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeout: 1000,
        monitoringWindow: 100 // 100ms
      });

      shortWindowBreaker.recordFailure();
      expect(shortWindowBreaker.getStats().failureCount).toBe(1);

      // Wait for monitoring window to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      // Record success to trigger cleanup
      shortWindowBreaker.recordSuccess();
      
      expect(shortWindowBreaker.getStats().failureCount).toBe(0);
    });
  });

  describe('default options', () => {
    it('should use default options when none provided', () => {
      const defaultBreaker = new CircuitBreaker();
      
      // Test that it works with defaults
      expect(defaultBreaker.canExecute()).toBe(true);
      
      // Should take 5 failures to open (default threshold)
      for (let i = 0; i < 5; i++) {
        defaultBreaker.recordFailure();
      }
      
      expect(defaultBreaker.getStats().state).toBe(CircuitState.OPEN);
    });
  });
});