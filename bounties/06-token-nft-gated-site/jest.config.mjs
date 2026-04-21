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
    // Critical spec paths: auth, gating, admin, asset-proxy, and cron metadata refresh.
    "src/lib/auth/session.ts",
    "src/app/api/auth/nonce/route.ts",
    "src/app/api/auth/logout/route.ts",
    "src/lib/rate-limit.ts",
    "src/lib/chains.ts",
    "src/lib/gating/evaluate.ts",
    "src/lib/gating/access.ts",
    "src/lib/metadata/token-metadata.ts",
    "src/lib/metadata/refresh-from-rules.ts",
    "src/app/api/admin/rules/route.ts",
    "src/app/api/protected/ping/route.ts",
    "src/app/api/assets/issue/route.ts",
    "src/app/api/assets/download/route.ts",
    "src/lib/assets/download-token.ts",
    "src/lib/assets/paths.ts",
    "src/lib/assets/read-gated-file.ts",
    "src/app/api/cron/metadata-refresh/route.ts",
  ],
  coverageReporters: ["text", "text-summary", "lcov"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
});
