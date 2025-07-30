// Jest test setup file
import 'dotenv/config';

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
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