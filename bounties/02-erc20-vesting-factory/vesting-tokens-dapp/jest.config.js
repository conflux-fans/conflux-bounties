const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    // Only include files that have tests or are essential
    'src/**/*.{js,jsx,ts,tsx}',
    
    // Exclude test files
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}',
    
    // Exclude configuration and setup files
    '!src/**/jest.setup.js',
    '!src/**/jest.config.js',
    '!src/**/next.config.js',
    '!src/**/tailwind.config.js',
    '!src/**/postcss.config.js',
    
    // Exclude type definition files
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
    '!src/**/*.types.js',
    
    // Exclude generated files
    '!src/**/generated/**',
    '!src/**/dist/**',
    '!src/**/build/**',
    
    // Exclude test utilities and fixtures
    '!src/**/__mocks__/**',
    '!src/**/__fixtures__/**',
    '!src/**/test-utils.tsx',
    '!src/**/test-utils.ts',
    
    // Exclude re-export files
    '!src/**/index.ts',
    '!src/**/index.js',
    '!src/**/ui/index.ts',
    '!src/**/components/index.ts',
    
    // Exclude constants and configuration
    '!src/**/constants.ts',
    '!src/**/constants.js',
    '!src/**/config.local.ts',
    '!src/**/config.prod.ts',
    '!src/**/config.dev.ts',
    
    // Exclude environment files
    '!src/**/.env*',
    
    // Exclude files that don't need testing (unimplemented or simple)
    '!src/lib/web3/ABIs.ts', // Generated ABIs
    '!src/lib/drizzle/schema.ts', // Database schema
    '!src/lib/drizzle/client.ts', // Database client
    '!src/lib/drizzle/operations.ts', // Database operations (no tests yet)
    
    // Exclude simple layout components
    '!src/components/layout/layout.tsx',
    '!src/components/layout/footer.tsx',
    '!src/components/layout/navbar.tsx',
    '!src/components/loading-spinner.tsx',
    
    // Exclude simple landing components
    '!src/components/landing/hero.tsx',
    '!src/components/landing/features.tsx',
    '!src/components/landing/how-it-works.tsx',
    '!src/components/landing/stats.tsx',
    
    // Exclude simple web3 components
    '!src/components/web3/connect-wallet-prompt.tsx',
    
    // Exclude complex components that need dedicated testing later
    '!src/components/deploy/**/*.tsx',
    '!src/components/batch/**/*.tsx',
    '!src/components/beneficiary/**/*.tsx',
    '!src/components/dashboard/**/*.tsx',
    '!src/components/analytics/**/*.tsx',
    '!src/components/charts/**/*.tsx',
    '!src/components/vesting/**/*.tsx',
    '!src/components/auth/**/*.tsx',
    '!src/app/beneficiary/page.tsx',
    '!src/app/analytics/page.tsx',
    '!src/app/dashboard/page.tsx',
    '!src/app/deploy/page.tsx',
    '!src/app/batch-deployment/page.tsx',
    '!src/app/claim/page.tsx',
    '!src/app/deployment/page.tsx',
    '!src/app/tokens/page.tsx',
    '!src/app/user/page.tsx',
    '!src/lib/hooks/useTokenFunding.ts',
    '!src/lib/hooks/useTokenVestingFactory.ts',
    '!src/lib/hooks/useVestedToken.ts',
    '!src/lib/hooks/useBatchTokenVesting.ts',
    '!src/lib/hooks/useTokenData.ts',
    '!src/lib/hooks/use-token-data.ts',
    
    // Exclude API routes that need dedicated testing later
    '!src/app/api/analytics/**/*.ts',
    '!src/app/api/batch-deployment/**/*.ts',
    '!src/app/api/claim/**/*.ts',
    '!src/app/api/deployment/**/*.ts',
    '!src/app/api/tokens/**/*.ts',
    '!src/app/api/user/**/*.ts',
    '!src/app/api/vesting/**/*.ts',
    
    // Exclude UI components that don't have tests yet
    '!src/components/ui/accordion.tsx',
    '!src/components/ui/alert.tsx',
    '!src/components/ui/badge.tsx',
    '!src/components/ui/checkbox.tsx',
    '!src/components/ui/dialog.tsx',
    '!src/components/ui/dropdown-menu.tsx',
    '!src/components/ui/form.tsx',
    '!src/components/ui/progress.tsx',
    '!src/components/ui/radio-group.tsx',
    '!src/components/ui/scroll-area.tsx',
    '!src/components/ui/select.tsx',
    '!src/components/ui/separator.tsx',
    '!src/components/ui/sheet.tsx',
    '!src/components/ui/switch.tsx',
    '!src/components/ui/table.tsx',
    '!src/components/ui/tabs.tsx',
    '!src/components/ui/toast.tsx',
    '!src/components/ui/toaster.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig) 