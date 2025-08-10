// Jest test setup file
import 'dotenv/config';

// Global resource tracking
const globalResources = {
  timers: new Set<NodeJS.Timeout>(),
  intervals: new Set<NodeJS.Timeout>(),
  processes: new Set<any>(),
  connections: new Set<any>(),
  eventListeners: new Map<any, string[]>()
};

// Override global setTimeout and setInterval for tracking
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

global.setTimeout = ((callback: any, delay?: number, ...args: any[]) => {
  const timer = originalSetTimeout(callback, delay, ...args);
  globalResources.timers.add(timer);
  return timer;
}) as any;

global.setInterval = ((callback: any, delay?: number, ...args: any[]) => {
  const interval = originalSetInterval(callback, delay, ...args);
  globalResources.intervals.add(interval);
  return interval;
}) as any;

global.clearTimeout = ((timer: any) => {
  if (timer) {
    globalResources.timers.delete(timer);
    return originalClearTimeout(timer);
  }
}) as any;

global.clearInterval = ((interval: any) => {
  if (interval) {
    globalResources.intervals.delete(interval);
    return originalClearInterval(interval);
  }
}) as any;

// Global test setup
beforeAll(async () => {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  process.env['LOG_LEVEL'] = 'error'; // Reduce log noise in tests

  // Set test database URL if not provided - try multiple options
  if (!process.env['TEST_DATABASE_URL']) {
    // Try localhost first (for local development), then postgres (for Docker)
    const testDbOptions = [
      'postgresql://webhook_user:webhook_pass@localhost:5432/webhook_relay_test',
      'postgresql://postgres:postgres@localhost:5432/webhook_relay_test',
      'postgresql://webhook_user:webhook_pass@postgres:5432/webhook_relay_test'
    ];
    process.env['TEST_DATABASE_URL'] = testDbOptions[0];
  }

  // Set test Redis URL if not provided
  if (!process.env['TEST_REDIS_URL']) {
    process.env['TEST_REDIS_URL'] = 'redis://redis:6379/1';
  }

  // Increase timeout for integration tests
  jest.setTimeout(30000);

  // Increase max listeners to prevent warnings
  process.setMaxListeners(100);

  // Set up process cleanup handlers
  const cleanupHandler = async (signal: string) => {
    console.log(`Received ${signal}, cleaning up test resources...`);
    await cleanupGlobalResources();
    process.exit(0);
  };

  process.on('SIGINT', () => cleanupHandler('SIGINT'));
  process.on('SIGTERM', () => cleanupHandler('SIGTERM'));
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception in tests:', error);
    cleanupGlobalResources().finally(() => process.exit(1)).catch(() => process.exit(1));
  });
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection in tests:', reason);
    cleanupGlobalResources().finally(() => process.exit(1)).catch(() => process.exit(1));
  });
});

afterAll(async () => {
  // Comprehensive cleanup after all tests
  await cleanupGlobalResources();

  // Wait for any remaining async operations
  await new Promise(resolve => originalSetTimeout(resolve, 100));
});

// Enhanced cleanup function
async function cleanupGlobalResources(): Promise<void> {
  const cleanupPromises: Promise<void>[] = [];

  // Clear all tracked timers
  for (const timer of globalResources.timers) {
    clearTimeout(timer);
  }
  globalResources.timers.clear();

  // Clear all tracked intervals
  for (const interval of globalResources.intervals) {
    clearInterval(interval);
  }
  globalResources.intervals.clear();

  // Clean up tracked processes
  for (const process of globalResources.processes) {
    if (process && typeof process.kill === 'function') {
      try {
        process.kill('SIGTERM');
      } catch (error) {
        // Ignore errors when killing processes
      }
    }
  }
  globalResources.processes.clear();

  // Clean up tracked connections
  for (const connection of globalResources.connections) {
    if (connection && typeof connection.close === 'function') {
      cleanupPromises.push(
        Promise.resolve(connection.close()).catch(() => {
          // Ignore connection close errors
        })
      );
    } else if (connection && typeof connection.end === 'function') {
      cleanupPromises.push(
        Promise.resolve(connection.end()).catch(() => {
          // Ignore connection end errors
        })
      );
    } else if (connection && typeof connection.destroy === 'function') {
      try {
        connection.destroy();
      } catch (error) {
        // Ignore destroy errors
      }
    }
  }
  globalResources.connections.clear();

  // Remove all tracked event listeners
  for (const [emitter] of globalResources.eventListeners) {
    if (emitter && typeof emitter.removeAllListeners === 'function') {
      try {
        emitter.removeAllListeners();
      } catch (error) {
        // Ignore listener removal errors
      }
    }
  }
  globalResources.eventListeners.clear();

  // Wait for all cleanup operations to complete with timeout
  if (cleanupPromises.length > 0) {
    try {
      await Promise.race([
        Promise.allSettled(cleanupPromises),
        new Promise(resolve => originalSetTimeout(resolve, 5000)) // 5 second timeout
      ]);
    } catch (error) {
      console.warn('Some cleanup operations failed:', error);
    }
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
}

// Global resource tracking utilities
(global as any).trackResource = (resource: any, type: 'timer' | 'interval' | 'process' | 'connection') => {
  switch (type) {
    case 'timer':
      globalResources.timers.add(resource);
      break;
    case 'interval':
      globalResources.intervals.add(resource);
      break;
    case 'process':
      globalResources.processes.add(resource);
      break;
    case 'connection':
      globalResources.connections.add(resource);
      break;
  }
};

(global as any).untrackResource = (resource: any, type: 'timer' | 'interval' | 'process' | 'connection') => {
  switch (type) {
    case 'timer':
      globalResources.timers.delete(resource);
      break;
    case 'interval':
      globalResources.intervals.delete(resource);
      break;
    case 'process':
      globalResources.processes.delete(resource);
      break;
    case 'connection':
      globalResources.connections.delete(resource);
      break;
  }
};

(global as any).trackEventListener = (emitter: any, event: string) => {
  if (!globalResources.eventListeners.has(emitter)) {
    globalResources.eventListeners.set(emitter, []);
  }
  globalResources.eventListeners.get(emitter)!.push(event);
};

(global as any).cleanupGlobalResources = cleanupGlobalResources;

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test helpers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Mock timers for performance tests
jest.setTimeout(120000); // 2 minutes for long-running tests

// Increase max listeners to prevent warnings in tests
process.setMaxListeners(50);