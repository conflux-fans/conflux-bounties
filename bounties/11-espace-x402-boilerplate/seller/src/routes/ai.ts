/**
 * AI endpoint — x402-gated Claude API
 */

import { Hono } from 'hono';
import { x402 } from '../middleware/x402.js';
import { env } from '../config/env.js';
import { logPayment } from '../services/payments.js';
import type { X402Env } from '../types.js';

const ai = new Hono<X402Env>();

ai.get('/', x402(), async (c) => {
  const question = c.req.query('q')?.trim();

  if (!question) {
    return c.json({ error: 'Query parameter "q" is required' }, 422);
  }
  if (question.length > 500) {
    return c.json({ error: 'Question too long (max 500 characters)' }, 422);
  }

  const settlement = c.get('x402');
  const token = c.get('x402Token');
  const network = c.get('x402Network');

  // Log payment for every settled request (regardless of Claude API availability)
  await logPayment(settlement, token, network, '/ai');

  // Fallback response when Claude API key is not configured
  if (!env.claudeApiKey) {
    return c.json({
      success: true,
      data: {
        answer: `x402 Protocol Demo: Your payment of ${formatTokenAmount(token.pricePerQuery, token.decimals)} ${token.symbol} was successfully processed! The x402 protocol enables HTTP 402 machine-to-machine payments on Conflux eSpace. This demo proves the full payment flow works: request → 402 → pay → settle → response. To get AI-powered answers, configure the CLAUDE_API_KEY environment variable.`,
        model: 'fallback',
        tokens_used: 0,
        payment: {
          tx_hash: settlement.transaction,
          payer: settlement.payer,
          amount: formatTokenAmount(token.pricePerQuery, token.decimals),
          token: token.symbol,
          network: network.name,
        },
      },
    });
  }

  // Call Claude API
  const systemPrompt = `You are a helpful AI assistant specializing in:
- Conflux Network (eSpace, Core Space, PoW+PoS consensus, CFX token)
- x402 protocol for machine-to-machine payments
- DeFi concepts (DEX, staking, liquidity, yield farming)
- Web3, blockchain, and smart contracts
Keep answers concise (under 200 words). Be accurate and technical when needed.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.claudeApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.claudeModel,
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: question }],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(`[ai] Anthropic API error (${res.status})`);
      // Payment already settled — return success with fallback answer instead of error
      return c.json({
        success: true,
        data: {
          answer: `Your payment was processed successfully. The AI service is temporarily unavailable (HTTP ${res.status}). Your payment of ${formatTokenAmount(token.pricePerQuery, token.decimals)} ${token.symbol} has been recorded — please try again shortly.`,
          model: 'fallback',
          tokens_used: 0,
          payment: {
            tx_hash: settlement.transaction,
            payer: settlement.payer,
            amount: formatTokenAmount(token.pricePerQuery, token.decimals),
            token: token.symbol,
            network: network.name,
          },
        },
      });
    }

    const result: any = await res.json();
    const answer = result.content?.[0]?.text || '';
    const tokensUsed = (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0);

    return c.json({
      success: true,
      data: {
        answer,
        model: env.claudeModel,
        tokens_used: tokensUsed,
        payment: {
          tx_hash: settlement.transaction,
          payer: settlement.payer,
          amount: formatTokenAmount(token.pricePerQuery, token.decimals),
          token: token.symbol,
          network: network.name,
        },
      },
    });
  } catch (err: any) {
    console.error('[ai] Error:', err.message);
    // Payment already settled — return success with fallback answer instead of error
    return c.json({
      success: true,
      data: {
        answer: `Your payment was processed successfully. The AI service is temporarily unavailable. Your payment of ${formatTokenAmount(token.pricePerQuery, token.decimals)} ${token.symbol} has been recorded — please try again shortly.`,
        model: 'fallback',
        tokens_used: 0,
        payment: {
          tx_hash: settlement.transaction,
          payer: settlement.payer,
          amount: formatTokenAmount(token.pricePerQuery, token.decimals),
          token: token.symbol,
          network: network.name,
        },
      },
    });
  }
});

function formatTokenAmount(amount: string, decimals: number): string {
  const val = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '') || '0';
  return `${whole}.${fracStr}`;
}

export { ai };
