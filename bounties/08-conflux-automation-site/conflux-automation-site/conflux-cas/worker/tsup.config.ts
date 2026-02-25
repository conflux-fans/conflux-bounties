import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/main.ts'],
  format: ['esm'],
  target: 'node20',
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: false,
});
