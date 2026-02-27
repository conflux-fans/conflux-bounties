import { defineConfig } from 'vitest/config';

export default defineConfig({
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
            statements: 80,
            lines: 80,
            branches: 80,
            functions: 80
        }
    }
});
