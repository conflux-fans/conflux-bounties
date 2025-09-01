const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    'app/api/**/*.{js,ts}',
    // Exclude frontend components from coverage
    '!components/**',
    '!app/page.tsx',
    '!app/layout.tsx',
    '!app/**/page.tsx',
    '!app/**/layout.tsx',
    // Exclude complex webhook route that requires database mocking
    '!app/api/webhook/**',
    '!lib/database.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 65,
      functions: 80,
      lines: 75,
      statements: 75,
    },
  },
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  coverageDirectory: 'coverage',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.(js|ts|tsx)',
    '**/*.(test|spec).(js|ts|tsx)',
  ],
  // Better handling of async operations
  testTimeout: 10000,
  // Proper environment configuration
  testEnvironmentOptions: {
    url: 'http://localhost:3000'
  },
  // Transform configuration for Next.js
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  // Global test setup
  globalSetup: '<rootDir>/jest.global-setup.js',
  globalTeardown: '<rootDir>/jest.global-teardown.js',
}

module.exports = createJestConfig(customJestConfig)