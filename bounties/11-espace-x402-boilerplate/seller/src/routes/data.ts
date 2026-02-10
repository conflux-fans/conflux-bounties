/**
 * Data endpoints — free + premium (x402-gated)
 */

import { Hono } from 'hono';
import { x402 } from '../middleware/x402.js';
import { logPayment } from '../services/payments.js';
import type { X402Env } from '../types.js';

const data = new Hono<X402Env>();

// Free endpoint — no payment required
data.get('/free', (c) => {
  return c.json({
    success: true,
    data: {
      message: 'This is free data — no payment required.',
      items: [
        { id: 1, name: 'Conflux Network', type: 'L1 Blockchain' },
        { id: 2, name: 'CFX', type: 'Native Token' },
        { id: 3, name: 'eSpace', type: 'EVM-Compatible Space' },
      ],
      timestamp: new Date().toISOString(),
    },
  });
});

// Premium endpoint — x402 payment required
data.get('/premium', x402(), async (c) => {
  const settlement = c.get('x402');
  const token = c.get('x402Token');
  const network = c.get('x402Network');

  await logPayment(settlement, token, network, '/data/premium');

  return c.json({
    success: true,
    data: {
      message: 'Premium data — paid via x402 protocol.',
      analytics: {
        totalTransactions: 1_284_567,
        dailyActiveUsers: 45_230,
        tvl: '$12.5M',
        topProtocols: [
          { name: 'Swappi', tvl: '$4.2M', volume24h: '$890K' },
          { name: 'Nucleon', tvl: '$3.8M', stakers: 12_450 },
          { name: 'Goledo', tvl: '$2.1M', borrowers: 3_200 },
        ],
      },
      payment: {
        txHash: settlement.transaction,
        payer: settlement.payer,
        token: token.symbol,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

export { data };
