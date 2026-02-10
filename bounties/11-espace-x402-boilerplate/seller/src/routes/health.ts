/**
 * Health check endpoint (free, no payment required)
 */

import { Hono } from 'hono';
import { env } from '../config/env.js';
import { getNetwork } from '../config/networks.js';

const health = new Hono();

health.get('/', (c) => {
  const network = getNetwork(env.network);

  return c.json({
    status: 'ok',
    service: 'x402-seller',
    version: '1.0.0',
    network: {
      name: network.name,
      chainId: network.chainId,
      caip2: network.caip2,
    },
    tokens: Object.entries(network.tokens).map(([symbol, token]) => ({
      symbol,
      address: token.address,
      decimals: token.decimals,
      paymentMethod: token.paymentMethod,
      pricePerQuery: token.pricePerQuery,
    })),
    treasury: env.treasury,
    timestamp: new Date().toISOString(),
  });
});

export { health };
