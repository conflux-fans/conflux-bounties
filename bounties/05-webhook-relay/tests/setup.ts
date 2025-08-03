// Jest test setup file
import 'dotenv/config';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  process.env['LOG_LEVEL'] = 'error'; // Reduce log noise in tests
  
  // Set test database URL if not provided
  if (!process.env['TEST_DATABASE_URL']) {
    process.env['TEST_DATABASE_URL'] = 'postgresql://webhook_user:webhook_pass@localhost:5432/webhook_relay_test';
  }
  
  // Set test Redis URL if not provided
  if (!process.env['TEST_REDIS_URL']) {
    process.env['TEST_REDIS_URL'] = 'redis://localhost:6379/1';
  }
});

afterAll(() => {
  // Cleanup after all tests
});

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
process.setMaxListeners(20);