/**
 * Hono context variable types for x402 middleware
 */

import type { TokenConfig, NetworkConfig } from './config/networks.js';

export interface SettlementResult {
  success: boolean;
  transaction?: string;
  payer?: string;
  error?: string;
}

export type X402Env = {
  Variables: {
    x402: SettlementResult;
    x402Token: TokenConfig;
    x402Network: NetworkConfig;
  };
};
