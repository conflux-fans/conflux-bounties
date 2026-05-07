import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    alias: {
      '@conflux-analytics/shared': path.resolve(__dirname, '../../shared/src/index.ts'),
    },
  },
});
