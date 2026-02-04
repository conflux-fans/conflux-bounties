import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/src/config/env.test-defaults.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/config/env.test-defaults.ts",
    "!src/index.ts",
    "!src/db/migrations/**",
  ],
};

export default config;
