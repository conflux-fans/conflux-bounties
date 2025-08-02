module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src'],
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.ts',
        '<rootDir>/src/**/?(*.)+(spec|test).ts'
      ],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            target: 'es2020',
            lib: ['es2020'],
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: true,
            resolveJsonModule: true,
            declaration: false,
            declarationMap: false,
            sourceMap: false
          }
        }],
      },
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
        '!src/index.ts',
        '!src/**/index.ts'
      ],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    },
    {
      displayName: 'integration',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/integration'],
      testMatch: [
        '<rootDir>/tests/integration/**/*.ts'
      ],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            target: 'es2020',
            lib: ['es2020'],
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: true,
            resolveJsonModule: true,
            declaration: false,
            declarationMap: false,
            sourceMap: false
          }
        }],
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/e2e'],
      testMatch: [
        '<rootDir>/tests/e2e/**/*.ts'
      ],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            target: 'es2020',
            lib: ['es2020'],
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: true,
            resolveJsonModule: true,
            declaration: false,
            declarationMap: false,
            sourceMap: false
          }
        }],
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    },
    {
      displayName: 'performance',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests/performance'],
      testMatch: [
        '<rootDir>/tests/performance/**/*.ts'
      ],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: {
            module: 'commonjs',
            target: 'es2020',
            lib: ['es2020'],
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: true,
            resolveJsonModule: true,
            declaration: false,
            declarationMap: false,
            sourceMap: false
          }
        }],
      },
      setupFilesAfterEnv: ['<rootDir>/tests/setup.ts']
    }
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000,
  verbose: true
};