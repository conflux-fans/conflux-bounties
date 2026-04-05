import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

export default createJestConfig({
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.mjs"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: [
    "src/lib/**/*.{ts,tsx}",
    "src/app/api/**/route.ts",
    "!src/**/*.test.ts",
    "!src/**/*.test.tsx",
  ],
  coverageReporters: ["text", "text-summary", "lcov"],
  /**
   * Global threshold tracks collected files (lib + API route handlers).
   * Raise toward ~80% as more routes and helpers gain tests.
   */
  coverageThreshold: {
    global: {
      branches: 44,
      functions: 68,
      lines: 51,
      statements: 50,
    },
    "./src/lib/gating/": {
      branches: 70,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    "./src/app/api/assets/download/route.ts": {
      branches: 64,
      functions: 100,
      lines: 85,
      statements: 85,
    },
  },
});
