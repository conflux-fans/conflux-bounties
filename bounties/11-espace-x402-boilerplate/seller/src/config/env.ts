/**
 * Environment configuration loader
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

export const env = {
  // Network
  network: process.env.NETWORK || 'testnet',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'x402',
    user: process.env.DB_USER || 'x402',
    pass: process.env.DB_PASS || '',
  },

  // Blockchain
  relayerKey: process.env.RELAYER_PRIVATE_KEY || '',
  treasury: process.env.TREASURY_ADDRESS || '',
  paymentContract: {
    testnet: process.env.PAYMENT_CONTRACT_TESTNET || '',
    mainnet: process.env.PAYMENT_CONTRACT_MAINNET || '',
  },

  // Facilitator
  facilitatorKey: process.env.FACILITATOR_KEY || '',
  facilitatorHost: process.env.FACILITATOR_HOST || '127.0.0.1',
  facilitatorPort: parseInt(process.env.FACILITATOR_PORT || '3851'),

  // AI
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022',

  // Seller
  sellerPort: parseInt(process.env.SELLER_PORT || '3852'),
  priceCfx: process.env.API_PRICE_CFX || '1000000000000000',
  priceToken: process.env.API_PRICE_TOKEN || '100',

  // Demo mode (testnet only)
  demoKey: process.env.AGENT_PRIVATE_KEY || '',
};
