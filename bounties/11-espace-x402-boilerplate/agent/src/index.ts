#!/usr/bin/env node
/**
 * x402 AI Agent — Autonomous machine-to-machine payment
 *
 * Detects HTTP 402, selects payment method based on token,
 * executes payment, and retries the request.
 *
 * Supports:
 *   - Native CFX:  Direct transfer to payment contract
 *   - ERC-20:      approve + submit to payment contract
 *   - EIP-3009:    Gasless transferWithAuthorization
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... npx tsx src/index.ts "What is Conflux?"
 *   AGENT_PRIVATE_KEY=0x... npx tsx src/index.ts --token CFX "What is Conflux?"
 *
 * @package x402-fullstack
 */

import { ethers } from 'ethers';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

// ── Config ──

const API_URL = process.env.AGENT_API_URL || 'http://localhost:3852';
const SPEND_CAP = parseFloat(process.env.AGENT_SPEND_CAP || '1.0');
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || '';

// Spending tracker (resets per process/session)
let totalSpent = 0;

const NETWORKS: Record<number, { rpc: string; explorer: string }> = {
  71: { rpc: 'https://evmtestnet.confluxrpc.com', explorer: 'https://evmtestnet.confluxscan.org' },
  1030: { rpc: 'https://evm.confluxrpc.com', explorer: 'https://evm.confluxscan.io' },
};

// EIP-3009 payment contract ABI
const PAYMENT_ABI = [
  'function payNative(bytes32 invoiceId) external payable',
  'function payWithToken(address token, uint256 amount, bytes32 invoiceId) external',
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// ── Terminal colors ──

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', white: '\x1b[37m',
  bgBlue: '\x1b[44m', bgGreen: '\x1b[42m', bgRed: '\x1b[41m', bgYellow: '\x1b[43m',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function step(num: number, total: number, icon: string, title: string) {
  console.log('');
  console.log(`  ${c.bgBlue}${c.white}${c.bold} STEP ${num}/${total} ${c.reset}  ${icon}  ${c.bold}${title}${c.reset}`);
  console.log(`  ${c.dim}${'─'.repeat(50)}${c.reset}`);
}

function kv(key: string, value: string, color = c.white) {
  console.log(`  ${c.dim}${key.padEnd(16)}${c.reset}${color}${value}${c.reset}`);
}

// ── Main ──

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  let tokenOverride: string | null = null;
  let question = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--token' && args[i + 1]) {
      tokenOverride = args[++i];
    } else {
      question = args[i];
    }
  }

  question = question || 'What is Conflux Network?';

  if (!PRIVATE_KEY) {
    console.error(`${c.red}Error: AGENT_PRIVATE_KEY required${c.reset}`);
    process.exit(1);
  }

  // Banner
  console.log(`\n${c.cyan}${c.bold}`);
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║   x402 Fullstack — AI Agent Demo             ║');
  console.log('  ║   Multi-token payment on Conflux eSpace      ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log(c.reset);

  // ═══ Step 1: Request API → 402 ═══
  step(1, 5, '\u{1F310}', 'Requesting AI API...');
  await sleep(300);

  const url = `${API_URL}/ai?q=${encodeURIComponent(question)}${tokenOverride ? `&token=${tokenOverride}` : ''}`;
  kv('GET', url.substring(0, 60) + '...', c.dim);

  const res1 = await fetch(url);
  if (res1.status !== 402) {
    console.error(`${c.red}  Expected 402, got ${res1.status}${c.reset}`);
    console.error(await res1.text());
    process.exit(1);
  }

  const reqHeader = res1.headers.get('PAYMENT-REQUIRED');
  if (!reqHeader) {
    console.error(`${c.red}  Missing PAYMENT-REQUIRED header${c.reset}`);
    process.exit(1);
  }

  const envelope = JSON.parse(Buffer.from(reqHeader, 'base64').toString());
  const requirements = envelope.accepts[0];
  const paymentMethod = requirements.extra.paymentMethod as string;
  const tokenSymbol = requirements.extra.symbol as string;
  const tokenDecimals = requirements.extra.decimals as number;
  const chainId = parseInt(requirements.network.split(':')[1]);

  const amountHuman = formatAmount(requirements.amount, tokenDecimals);

  console.log(`\n  ${c.bgYellow}${c.bold} HTTP 402 ${c.reset}  ${c.yellow}Payment Required${c.reset}`);
  kv('Token', `${tokenSymbol} (${paymentMethod})`, c.yellow);
  kv('Price', `${amountHuman} ${tokenSymbol}`, c.yellow);
  kv('Pay to', requirements.payTo.substring(0, 12) + '...', c.dim);
  kv('Chain', `${chainId}`, c.blue);

  // ── Spending cap check ──
  const cost = parseFloat(amountHuman);
  if (totalSpent + cost > SPEND_CAP) {
    console.log(`\n  ${c.bgRed}${c.white}${c.bold} SPENDING CAP EXCEEDED ${c.reset}`);
    kv('Spent', `${totalSpent}`, c.red);
    kv('This request', `${amountHuman}`, c.red);
    kv('Cap', `${SPEND_CAP}`, c.red);
    console.log(`\n  ${c.dim}Set AGENT_SPEND_CAP to increase the limit.${c.reset}\n`);
    process.exit(1);
  }
  kv('Spend cap', `${totalSpent + cost} / ${SPEND_CAP} ${tokenSymbol}`, c.dim);

  // ═══ Step 2: Connect wallet ═══
  step(2, 5, '\u{1F4B0}', 'Connecting agent wallet...');

  const networkCfg = NETWORKS[chainId];
  if (!networkCfg) {
    console.error(`${c.red}  Unsupported chain: ${chainId}${c.reset}`);
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(networkCfg.rpc);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  kv('Agent', wallet.address.substring(0, 8) + '...' + wallet.address.substring(38), c.cyan);

  // Check balance
  if (paymentMethod === 'native') {
    const balance = await provider.getBalance(wallet.address);
    kv('Balance', `${ethers.formatEther(balance)} CFX`, c.green);
    if (balance < BigInt(requirements.amount)) {
      console.log(`\n  ${c.bgRed} INSUFFICIENT BALANCE ${c.reset}`);
      process.exit(1);
    }
  } else {
    const erc20 = new ethers.Contract(requirements.asset, ERC20_ABI, provider);
    const balance = await erc20.balanceOf(wallet.address);
    kv('Balance', `${formatAmount(balance.toString(), tokenDecimals)} ${tokenSymbol}`, c.green);
    if (balance < BigInt(requirements.amount)) {
      console.log(`\n  ${c.bgRed} INSUFFICIENT BALANCE ${c.reset}`);
      process.exit(1);
    }
  }

  console.log(`  ${c.green}\u2713 Sufficient balance${c.reset}`);

  // ═══ Step 3: Prepare payment ═══
  step(3, 5, '\u270D\uFE0F', `Preparing ${paymentMethod} payment...`);
  await sleep(300);

  let x402Payload: any;

  if (paymentMethod === 'eip3009') {
    // Gasless: sign EIP-712
    const nonce = ethers.hexlify(ethers.randomBytes(32));
    const now = Math.floor(Date.now() / 1000);

    const domain = {
      name: requirements.extra.name,
      version: requirements.extra.version,
      chainId,
      verifyingContract: requirements.asset,
    };

    const message = {
      from: wallet.address,
      to: requirements.payTo,
      value: requirements.amount,
      validAfter: 0,
      validBefore: now + 3600,
      nonce,
    };

    const signature = await wallet.signTypedData(domain, TRANSFER_AUTH_TYPES, message);
    kv('Type', 'EIP-712 TransferWithAuthorization', c.dim);
    kv('Signature', signature.substring(0, 22) + '...', c.green);

    x402Payload = {
      x402Version: 2, scheme: 'exact', network: requirements.network,
      payload: { signature, authorization: { ...message, validAfter: '0', validBefore: String(now + 3600) } },
    };

  } else if (paymentMethod === 'erc20') {
    // approve + submit
    const paymentContract = requirements.extra.paymentContract;
    const erc20 = new ethers.Contract(requirements.asset, ERC20_ABI, wallet);

    // Check existing allowance
    const allowance = await erc20.allowance(wallet.address, paymentContract);
    if (allowance < BigInt(requirements.amount)) {
      kv('Action', 'Approving token spend...', c.yellow);
      const approveTx = await erc20.approve(paymentContract, requirements.amount);
      await approveTx.wait();
      kv('Approve TX', approveTx.hash.substring(0, 18) + '...', c.green);
    } else {
      kv('Allowance', 'Already approved', c.green);
    }

    x402Payload = {
      x402Version: 2, scheme: 'exact', network: requirements.network,
      payload: {
        from: wallet.address,
        amount: requirements.amount,
        invoiceId: crypto.randomUUID().replace(/-/g, ''),
        approveTxHash: null,
      },
    };

  } else {
    // Native CFX: send to payment contract
    const paymentContract = requirements.extra.paymentContract;
    const contract = new ethers.Contract(paymentContract, PAYMENT_ABI, wallet);
    const invoiceId = ethers.zeroPadValue(ethers.toUtf8Bytes('x402-agent'), 32);

    kv('Action', 'Sending CFX payment...', c.yellow);
    const tx = await contract.payNative(invoiceId, { value: requirements.amount, gasLimit: 100_000 });
    const receipt = await tx.wait();
    kv('TX', receipt!.hash.substring(0, 18) + '...', c.green);

    x402Payload = {
      x402Version: 2, scheme: 'exact', network: requirements.network,
      payload: { txHash: receipt!.hash, from: wallet.address, amount: requirements.amount },
    };
  }

  console.log(`  ${c.green}\u2713 Payment prepared${c.reset}`);

  // ═══ Step 4: Send paid request ═══
  step(4, 5, '\u{1F680}', 'Sending paid request...');
  await sleep(300);

  const paymentSig = Buffer.from(JSON.stringify(x402Payload)).toString('base64');
  const res2 = await fetch(url, { headers: { 'PAYMENT-SIGNATURE': paymentSig } });
  const data: any = await res2.json();

  if (res2.status !== 200 || !data.success) {
    console.log(`\n  ${c.bgRed} PAYMENT FAILED ${c.reset}`);
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  // Update spending tracker
  totalSpent += cost;

  console.log(`\n  ${c.bgGreen}${c.white}${c.bold} HTTP 200 — PAID & SETTLED ${c.reset}`);

  // ═══ Step 5: Display result ═══
  step(5, 5, '\u2728', 'Result');

  const txHash = data.data.payment.tx_hash;
  kv('TX Hash', txHash, c.green);
  kv('Payer', data.data.payment.payer, c.cyan);
  kv('Amount', `${data.data.payment.amount} ${data.data.payment.token}`, c.yellow);
  kv('Model', data.data.model, c.dim);
  kv('Tokens', String(data.data.tokens_used), c.dim);
  kv('Explorer', `${networkCfg.explorer}/tx/${txHash}`, c.blue);

  console.log(`\n${c.cyan}${c.bold}  AI Answer:${c.reset}\n`);

  // Word-wrap the answer
  const answer = data.data.answer;
  const words = answer.split(' ');
  let line = '  ';
  for (const word of words) {
    if (line.length + word.length > 70) {
      console.log(line);
      line = '  ';
    }
    line += (line.trim() ? ' ' : '') + word;
  }
  if (line.trim()) console.log(line);

  console.log(`\n  ${c.dim}${'─'.repeat(50)}${c.reset}`);
  console.log(`  ${c.bold}Powered by x402 Protocol on Conflux eSpace${c.reset}\n`);
}

function formatAmount(amount: string, decimals: number): string {
  const val = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '') || '0';
  return `${whole}.${fracStr}`;
}

main().catch((err) => {
  console.error(`\n${c.red}Fatal: ${err.message}${c.reset}`);
  process.exit(1);
});
