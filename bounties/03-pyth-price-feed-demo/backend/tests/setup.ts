import dotenv from 'dotenv';
import { join } from 'path';

const envPath = join(__dirname, '..', '.env.test');
dotenv.config({ path: envPath });

process.env.NODE_ENV = 'test';

jest.setTimeout(10000);

const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: originalConsole.error,
  };
});

afterAll(async () => {
  global.console = originalConsole;
  
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterEach(() => {
  jest.clearAllMocks();
});