/**
 * Facilitator configuration
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

export const cfg = {
  port: parseInt(process.env.FACILITATOR_PORT || '3851'),
  host: process.env.FACILITATOR_BIND || '0.0.0.0',
  apiKey: process.env.FACILITATOR_KEY || '',
  relayerKey: process.env.RELAYER_PRIVATE_KEY || '',
  treasury: process.env.TREASURY_ADDRESS || '',
  network: process.env.NETWORK || 'testnet',
  paymentContract: {
    testnet: process.env.PAYMENT_CONTRACT_TESTNET || '',
    mainnet: process.env.PAYMENT_CONTRACT_MAINNET || '',
  },
  demoKey: process.env.AGENT_PRIVATE_KEY || '',
};

export const NETWORKS: Record<string, { rpc: string; chainId: number }> = {
  testnet: { rpc: 'https://evmtestnet.confluxrpc.com', chainId: 71 },
  mainnet: { rpc: 'https://evm.confluxrpc.com', chainId: 1030 },
};

// EIP-712 types for TransferWithAuthorization
export const TRANSFER_AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

// X402PaymentReceiver ABI (for ERC-20 and native payments)
export const PAYMENT_RECEIVER_ABI = [
  'function payNative(bytes32 invoiceId) external payable',
  'function payWithToken(address token, uint256 amount, bytes32 invoiceId) external',
  'function payWithTokenFrom(address token, address from, uint256 amount, bytes32 invoiceId) external',
  'function payWithAuthorization(address token, address from, uint256 amount, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature, bytes32 invoiceId) external',
  'event PaymentReceived(bytes32 indexed invoiceId, address indexed payer, address token, uint256 amount, string paymentMethod)',
];

// Standard ABI fragments
export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export const EIP3009_ABI = [
  'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) external',
];
