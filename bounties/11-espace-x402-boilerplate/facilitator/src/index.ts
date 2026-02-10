/**
 * x402 Facilitator Service
 *
 * Handles payment verification and settlement for three methods:
 *   - EIP-3009: Gasless transferWithAuthorization (USDT0)
 *   - ERC-20:   approve + transferFrom via payment contract
 *   - Native:   Direct CFX transfer verification
 *
 * @package x402-fullstack
 */

import http from 'http';
import { ethers } from 'ethers';
import { cfg, NETWORKS } from './config.js';
import { verifyEip3009, settleEip3009 } from './handlers/eip3009.js';
import { verifyErc20, settleErc20 } from './handlers/erc20.js';
import { verifyNative, settleNative } from './handlers/native.js';

// ── Blockchain connection ──

const defaultNetworkCfg = NETWORKS[cfg.network];
if (!defaultNetworkCfg) {
  console.error(`[facilitator] Unknown network: ${cfg.network}`);
  process.exit(1);
}

const defaultProvider = new ethers.JsonRpcProvider(defaultNetworkCfg.rpc);
const defaultWallet = new ethers.Wallet(cfg.relayerKey, defaultProvider);

// Provider cache for dynamic network selection
const providerCache: Record<number, ethers.JsonRpcProvider> = {};
const walletCache: Record<number, ethers.Wallet> = {};

function getProviderForChain(chainId: number): ethers.JsonRpcProvider {
  if (providerCache[chainId]) return providerCache[chainId];
  const net = Object.values(NETWORKS).find((n) => n.chainId === chainId);
  if (!net) throw new Error(`Unsupported chain: ${chainId}`);
  providerCache[chainId] = new ethers.JsonRpcProvider(net.rpc);
  return providerCache[chainId];
}

function getWalletForChain(chainId: number): ethers.Wallet {
  if (walletCache[chainId]) return walletCache[chainId];
  const provider = getProviderForChain(chainId);
  walletCache[chainId] = new ethers.Wallet(cfg.relayerKey, provider);
  return walletCache[chainId];
}

// ── Helpers ──

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_048_576) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function checkAuth(req: http.IncomingMessage): boolean {
  const key = req.headers['x-api-key'];
  return key === cfg.apiKey;
}

// ── Request handler ──

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://localhost:${cfg.port}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // Health check
  if (path === '/x402/health' && req.method === 'GET') {
    const balance = await defaultProvider.getBalance(defaultWallet.address);
    return sendJson(res, 200, {
      status: 'ok',
      network: cfg.network,
      chainId: defaultNetworkCfg.chainId,
      facilitator: defaultWallet.address,
      balanceCFX: ethers.formatEther(balance),
      paymentContract: cfg.network === 'testnet' ? cfg.paymentContract.testnet : cfg.paymentContract.mainnet,
    });
  }

  // All other endpoints require auth
  if (!checkAuth(req)) return sendJson(res, 401, { error: 'Invalid API key' });

  let body: any;
  try { body = await parseBody(req); }
  catch { return sendJson(res, 400, { error: 'Invalid request body' }); }

  // Resolve provider/wallet for the request's chain
  const reqChainId = body?.network?.chainId;
  let reqProvider: ethers.JsonRpcProvider;
  let reqWallet: ethers.Wallet;
  try {
    reqProvider = reqChainId ? getProviderForChain(reqChainId) : defaultProvider;
    reqWallet = reqChainId ? getWalletForChain(reqChainId) : defaultWallet;
  } catch {
    return sendJson(res, 400, { error: `Unsupported chain: ${reqChainId}` });
  }

  // ── EIP-3009 ──
  if (path === '/x402/verify-eip3009' && req.method === 'POST') {
    const result = await verifyEip3009(body, reqProvider);
    return sendJson(res, 200, result);
  }
  if (path === '/x402/settle-eip3009' && req.method === 'POST') {
    const result = await settleEip3009(body, reqWallet);
    return sendJson(res, result.success ? 200 : 500, result);
  }

  // ── ERC-20 ──
  if (path === '/x402/verify-erc20' && req.method === 'POST') {
    const result = await verifyErc20(body, reqProvider);
    return sendJson(res, 200, result);
  }
  if (path === '/x402/settle-erc20' && req.method === 'POST') {
    const result = await settleErc20(body, reqWallet);
    return sendJson(res, result.success ? 200 : 500, result);
  }

  // ── Native CFX ──
  if (path === '/x402/verify-native' && req.method === 'POST') {
    const result = await verifyNative(body, reqProvider);
    return sendJson(res, 200, result);
  }
  if (path === '/x402/settle-native' && req.method === 'POST') {
    const result = await settleNative(body, reqWallet);
    return sendJson(res, result.success ? 200 : 500, result);
  }

  sendJson(res, 404, { error: 'Not found' });
}

// ── Server ──

const server = http.createServer(handleRequest);

async function start() {
  console.log('[facilitator] x402 Facilitator v1.0.0');
  console.log(`[facilitator] Default network: ${cfg.network} (chain ${defaultNetworkCfg.chainId})`);
  console.log(`[facilitator] Supports: ${Object.entries(NETWORKS).map(([k, v]) => `${k}(${v.chainId})`).join(', ')}`);
  console.log(`[facilitator] Relayer: ${defaultWallet.address}`);

  const balance = await defaultProvider.getBalance(defaultWallet.address);
  console.log(`[facilitator] Balance: ${ethers.formatEther(balance)} CFX`);

  const contract = cfg.network === 'testnet' ? cfg.paymentContract.testnet : cfg.paymentContract.mainnet;
  console.log(`[facilitator] Payment contract: ${contract || 'NOT SET'}`);

  server.listen(cfg.port, cfg.host, () => {
    console.log(`[facilitator] Listening on http://${cfg.host}:${cfg.port}`);
    console.log('[facilitator] Endpoints:');
    console.log('  GET  /x402/health');
    console.log('  POST /x402/verify-eip3009   POST /x402/settle-eip3009');
    console.log('  POST /x402/verify-erc20     POST /x402/settle-erc20');
    console.log('  POST /x402/verify-native    POST /x402/settle-native');
  });
}

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });

start().catch((err) => { console.error('[facilitator] Fatal:', err); process.exit(1); });
