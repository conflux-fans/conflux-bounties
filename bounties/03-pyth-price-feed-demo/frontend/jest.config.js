export default {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',

  roots: ['<rootDir>/src'],

  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.test.tsx',
  ],

  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        moduleResolution: 'node',
      },
    }],
  },

  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|svg|wav|mp3)$': '<rootDir>/mocks/fileMock.js',
  },

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/main.tsx',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],

  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
  },

  coverageDirectory: 'coverage',
  verbose: true,
};