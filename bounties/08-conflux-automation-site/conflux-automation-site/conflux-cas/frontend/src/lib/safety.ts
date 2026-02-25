import type { SafetyConfig } from '@conflux-cas/shared';

export const DEFAULT_SAFETY_CONFIG: SafetyConfig = {
  maxSwapUsd: 10_000,
  maxSlippageBps: 500,
  maxRetries: 5,
  minExecutionIntervalSeconds: 30,
  globalPause: false,
};
