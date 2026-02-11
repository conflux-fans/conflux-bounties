/**
 * x402 Payment Middleware for Hono
 *
 * Intercepts requests to paid endpoints:
 *   - No PAYMENT-SIGNATURE → 402 with PaymentRequired envelope
 *   - With PAYMENT-SIGNATURE → verify + settle via facilitator
 *
 * Supports three payment methods:
 *   - native:  Direct CFX transfer via payment contract
 *   - eip3009: Gasless EIP-3009 transferWithAuthorization
 *   - erc20:   Standard approve + transferFrom via payment contract
 *
 * @package x402-fullstack
 */

import type { Context, Next } from 'hono';
import { ethers } from 'ethers';
import { env } from '../config/env.js';
import { getNetwork, type TokenConfig, type NetworkConfig } from '../config/networks.js';
import type { X402Env, SettlementResult } from '../types.js';

const FACILITATOR_URL = `http://${env.facilitatorHost}:${env.facilitatorPort}`;

const PAYMENT_ABI = [
  'function payNative(bytes32 invoiceId) external payable',
  'function payWithToken(address token, uint256 amount, bytes32 invoiceId) external',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

/**
 * Creates x402 middleware for a specific token
 */
export function x402(tokenSymbol?: string) {
  return async (c: Context<X402Env>, next: Next) => {
    const networkName = c.req.query('network') || env.network;
    const network = getNetwork(networkName);
    const symbol = tokenSymbol || c.req.query('token') || getDefaultToken(network);
    const token = network.tokens[symbol];

    if (!token) {
      return c.json({ error: `Unsupported token: ${symbol}` }, 400);
    }

    const paymentHeader = c.req.header('PAYMENT-SIGNATURE')
      || c.req.header('payment-signature');

    const paymentContract = networkName === 'testnet'
      ? env.paymentContract.testnet
      : env.paymentContract.mainnet;

    const isDemo = c.req.query('demo') === '1';

    if (!paymentHeader) {
      // Demo mode: server pays with its own key on testnet (native + erc20)
      if (isDemo && networkName === 'testnet' && env.demoKey
          && (token.paymentMethod === 'native' || token.paymentMethod === 'erc20')) {
        const demoResult = token.paymentMethod === 'native'
          ? await demoPayNative(network, token, paymentContract)
          : await demoPayErc20(network, token, paymentContract);
        if (demoResult.success) {
          c.set('x402', demoResult);
          c.set('x402Token', token);
          c.set('x402Network', network);
          await next();
          return;
        }
        return c.json({ error: 'Demo payment failed', message: demoResult.error }, 500);
      }

      return send402(c, network, token, paymentContract);
    }

    // Verify and settle payment
    const settlement = await verifyAndSettle(paymentHeader, network, token, paymentContract);

    if (!settlement.success) {
      return c.json({
        error: 'Payment failed',
        message: settlement.error,
      }, 402);
    }

    // Attach settlement to context for downstream handlers
    c.set('x402', settlement);
    c.set('x402Token', token);
    c.set('x402Network', network);

    await next();
  };
}

function getDefaultToken(network: NetworkConfig): string {
  // Prefer CFX on testnet, USDT0 on mainnet (if available)
  if (network.tokens['USDT0']) return 'USDT0';
  return 'CFX';
}

function send402(c: Context, network: NetworkConfig, token: TokenConfig, paymentContract: string) {
  const invoiceId = crypto.randomUUID().replace(/-/g, '');
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const endpoint = new URL(c.req.url).pathname;

  const resourceUrl = `${c.req.url.split('?')[0]}`;

  // Build x402 V2 PaymentRequired envelope
  const paymentRequired = {
    x402Version: 2,
    error: 'PAYMENT-SIGNATURE header is required',
    resource: {
      url: resourceUrl,
      description: `API query — ${formatAmount(token.pricePerQuery, token)} ${token.symbol} per request`,
      mimeType: 'application/json',
    },
    accepts: [{
      scheme: 'exact',
      network: network.caip2,
      amount: token.pricePerQuery,
      asset: token.address,
      payTo: env.treasury,
      maxTimeoutSeconds: 3600,
      extra: {
        paymentMethod: token.paymentMethod,
        symbol: token.symbol,
        decimals: token.decimals,
        ...(token.eip712Name ? { name: token.eip712Name, version: token.eip712Version } : {}),
        paymentContract,
      },
    }],
  };

  // Set all required headers
  c.header('PAYMENT-REQUIRED', Buffer.from(JSON.stringify(paymentRequired)).toString('base64'));
  c.header('X-Payment-Amount', token.pricePerQuery);
  c.header('X-Payment-Token', token.address);
  c.header('X-Payment-Nonce', nonce);
  c.header('X-Payment-Expiry', String(expiry));
  c.header('X-Payment-Endpoint', endpoint);
  c.header('X-Payment-Invoice-Id', invoiceId);

  c.status(402);
  return c.json({ error: 'Payment required' });
}

async function verifyAndSettle(
  paymentHeader: string,
  network: NetworkConfig,
  token: TokenConfig,
  paymentContract: string,
): Promise<SettlementResult> {
  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
  } catch {
    return { success: false, error: 'Invalid PAYMENT-SIGNATURE header' };
  }

  // Route to correct facilitator endpoint based on payment method
  const routes = {
    eip3009: { verify: '/x402/verify-eip3009', settle: '/x402/settle-eip3009' },
    erc20: { verify: '/x402/verify-erc20', settle: '/x402/settle-erc20' },
    native: { verify: '/x402/verify-native', settle: '/x402/settle-native' },
  };

  const route = routes[token.paymentMethod];

  // Step 1: Verify
  const verifyResult = await callFacilitator(route.verify, {
    payload,
    token: {
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      paymentMethod: token.paymentMethod,
      pricePerQuery: token.pricePerQuery,
      ...(token.eip712Name ? { eip712Name: token.eip712Name, eip712Version: token.eip712Version } : {}),
    },
    network: {
      chainId: network.chainId,
      caip2: network.caip2,
    },
    treasury: env.treasury,
    paymentContract,
  });

  if (!verifyResult || !verifyResult.valid) {
    return { success: false, error: verifyResult?.reason || 'Verification failed' };
  }

  // Step 2: Settle
  const settleResult = await callFacilitator(route.settle, {
    payload,
    token: {
      address: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      paymentMethod: token.paymentMethod,
      pricePerQuery: token.pricePerQuery,
      ...(token.eip712Name ? { eip712Name: token.eip712Name, eip712Version: token.eip712Version } : {}),
    },
    network: {
      chainId: network.chainId,
      caip2: network.caip2,
    },
    treasury: env.treasury,
    paymentContract,
  });

  if (!settleResult || !settleResult.success) {
    return { success: false, error: settleResult?.error || 'Settlement failed' };
  }

  return {
    success: true,
    transaction: settleResult.transaction,
    payer: settleResult.payer,
  };
}

async function callFacilitator(endpoint: string, data: any): Promise<any> {
  try {
    const res = await fetch(`${FACILITATOR_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.facilitatorKey,
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(30000),
    });
    return await res.json();
  } catch (err: any) {
    console.error(`[x402] Facilitator error (${endpoint}):`, err.message);
    return null;
  }
}

/**
 * Demo mode: server pays native CFX on testnet using its own agent key
 */
async function demoPayNative(
  network: NetworkConfig,
  token: TokenConfig,
  paymentContract: string,
): Promise<SettlementResult> {
  try {
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const wallet = new ethers.Wallet(env.demoKey, provider);
    const contract = new ethers.Contract(paymentContract, PAYMENT_ABI, wallet);
    const invoiceId = ethers.zeroPadValue(ethers.toUtf8Bytes('x402-demo'), 32);

    const tx = await contract.payNative(invoiceId, {
      value: token.pricePerQuery,
      gasLimit: 100_000,
    });
    const receipt = await tx.wait();

    console.log(`[x402] Demo payment: ${receipt!.hash} (${wallet.address})`);

    return {
      success: true,
      transaction: receipt!.hash,
      payer: wallet.address,
    };
  } catch (err: any) {
    console.error('[x402] Demo payment error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Demo mode: server pays ERC-20 token on testnet using its own agent key
 */
async function demoPayErc20(
  network: NetworkConfig,
  token: TokenConfig,
  paymentContract: string,
): Promise<SettlementResult> {
  try {
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const wallet = new ethers.Wallet(env.demoKey, provider);
    const erc20 = new ethers.Contract(token.address, ERC20_ABI, wallet);
    const contract = new ethers.Contract(paymentContract, PAYMENT_ABI, wallet);
    const invoiceId = ethers.zeroPadValue(ethers.toUtf8Bytes('x402-demo'), 32);

    // Approve if needed
    const allowance: bigint = await erc20.allowance(wallet.address, paymentContract);
    if (allowance < BigInt(token.pricePerQuery)) {
      const approveTx = await erc20.approve(paymentContract, ethers.MaxUint256);
      await approveTx.wait();
      console.log(`[x402] Demo: approved ${token.symbol} for payment contract`);
    }

    const tx = await contract.payWithToken(token.address, token.pricePerQuery, invoiceId, {
      gasLimit: 150_000,
    });
    const receipt = await tx.wait();

    console.log(`[x402] Demo ERC-20 payment: ${receipt!.hash} (${token.symbol})`);

    return {
      success: true,
      transaction: receipt!.hash,
      payer: wallet.address,
    };
  } catch (err: any) {
    console.error(`[x402] Demo ERC-20 payment error (${token.symbol}):`, err.message);
    return { success: false, error: err.message };
  }
}

function formatAmount(amount: string, token: TokenConfig): string {
  const val = BigInt(amount);
  const divisor = BigInt(10 ** token.decimals);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac.toString().padStart(token.decimals, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}
