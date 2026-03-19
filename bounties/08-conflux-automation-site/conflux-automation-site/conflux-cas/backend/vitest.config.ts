import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Use a temp in-memory SQLite path per test run
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
