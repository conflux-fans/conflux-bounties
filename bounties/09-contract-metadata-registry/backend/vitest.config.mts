import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@conflux-metadata/shared': path.resolve(__dirname, '../shared/src/index.ts'),
        },
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        setupFiles: ['./src/test/setup.ts'],
        deps: {
            optimizer: {
                web: { include: ['fastify'] },
                ssr: { include: ['fastify'] }
            }
        },
        coverage: {
            provider: 'istanbul',
            reporter: ['text', 'json', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/test/**',
                'src/scripts/**',
                'src/server.ts',
                'src/services/ipfs.ts',
                'src/routes/assets.ts'
            ],
            thresholds: {
                statements: 80,
                lines: 80,
                branches: 80,
                functions: 80
            }
        }
    }
});
