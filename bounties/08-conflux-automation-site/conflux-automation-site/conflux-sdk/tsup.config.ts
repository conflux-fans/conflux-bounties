import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'clients/index': 'src/clients/index.ts',
    'config/index': 'src/config/index.ts',
    'types/index': 'src/types/index.ts',
    'utils/index': 'src/utils/index.ts',
    'wallet/index': 'src/wallet/index.ts',
    'contracts/index': 'src/contracts/index.ts',
    'services/index': 'src/services/index.ts',
    'automation/index': 'src/automation/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  minify: false,
  external: [
    'cive',
    'viem',
    'react',
    'react-dom',
  ],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
