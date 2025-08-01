/**
 * Circuit breaker pattern implementation for webhook delivery
 * Prevents cascading failures by temporarily disabling failing webhooks
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
}

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date | undefined;
  nextAttemptTime?: Date | undefined;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | undefined;
  private nextAttemptTime: Date | undefined;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      monitoringWindow: options.monitoringWindow || 300000 // 5 minutes
    };
  }

  /**
   * Check if the circuit breaker allows the operation
   */
  canExecute(): boolean {
    const now = new Date();

    // If circuit is closed, allow execution
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    // If circuit is open, check if reset timeout has passed
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttemptTime && now >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // If circuit is half-open, allow one attempt
    if (this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    return false;
  }

  /**
   * Record a successful operation
   */
  recordSuccess(): void {
    this.successCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      // Reset circuit breaker on successful half-open attempt
      this.reset();
    }

    // Clean up old failures outside monitoring window
    this.cleanupOldFailures();
  }

  /**
   * Record a failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed half-open attempt, go back to open
      this.openCircuit();
      return;
    }

    if (this.state === CircuitState.CLOSED && this.failureCount >= this.options.failureThreshold) {
      this.openCircuit();
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }

  /**
   * Force the circuit breaker to open state
   */
  forceOpen(): void {
    this.openCircuit();
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.options.resetTimeout);
  }

  /**
   * Clean up failure counts outside the monitoring window
   */
  private cleanupOldFailures(): void {
    if (!this.lastFailureTime) {
      return;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - this.options.monitoringWindow);

    if (this.lastFailureTime < windowStart) {
      // Reset failure count if last failure was outside monitoring window
      this.failureCount = 0;
      this.lastFailureTime = undefined;
    }
  }
}