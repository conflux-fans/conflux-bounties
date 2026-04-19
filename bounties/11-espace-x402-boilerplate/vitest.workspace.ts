import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/shared",
  "packages/x402-sdk",
  // packages/contracts uses Hardhat test runner (chai + ethers), not vitest.
  // Run contract tests via: npm run test -w packages/contracts
  "apps/seller-api",
  "apps/agent",
  {
    extends: "apps/web/vitest.config.ts",
    test: {
      name: "web",
      root: "apps/web",
    },
  },
]);
