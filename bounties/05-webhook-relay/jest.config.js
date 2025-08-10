module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/src', '<rootDir>/tests/factories'],
      testMatch: [
        '<rootDir>/src/**/__tests__/**/*.ts',
        '<rootDir>/src/**/?(*.)+(spec|test).ts',
        '<rootDir>/tests/factories/__tests__/**/*.ts'
      ],
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          tsconfig: '<rootDir>/tests/tsconfig.json'
        }],
      },
      collectCoverageFrom: [
        'src/**/*.ts',
        'tests/factories/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.test.ts',
        '!src/**/*.spec.ts',
        '!src/index.ts',
        '!src/**/index.ts',
        '!tests/factories/**/__tests__/**/*.ts'
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
          tsconfig: '<rootDir>/tests/tsconfig.json'
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
          tsconfig: '<rootDir>/tests/tsconfig.json'
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
          tsconfig: '<rootDir>/tests/tsconfig.json'
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
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  testTimeout: 30000,
  verbose: true,
  // Global teardown to ensure cleanup
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  // Detect open handles to identify resource leaks
  detectOpenHandles: true,
  // Force exit after tests complete
  forceExit: true,
  // Maximum number of worker processes
  maxWorkers: '50%'
};