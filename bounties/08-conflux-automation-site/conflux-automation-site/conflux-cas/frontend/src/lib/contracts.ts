/**
 * AutomationManager contract ABI (subset) and helpers.
 *
 * The full artifact lives at:
 *   contracts/artifacts/contracts/AutomationManager.sol/AutomationManager.json
 *
 * We only include the fragments needed by the frontend:
 *   - createLimitOrder
 *   - createDCAJob
 *   - JobCreated event
 */

import type { Address } from 'viem';

export const AUTOMATION_MANAGER_ADDRESS: Address =
  (process.env.NEXT_PUBLIC_AUTOMATION_MANAGER_ADDRESS as Address | undefined) ??
  '0x0000000000000000000000000000000000000000';

// ─── Minimal ERC-20 ABI (allowance + approve) ────────────────────────────────

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

// ─── WCFX (Wrapped CFX) ABI ──────────────────────────────────────────────────
// Follows the WETH pattern: deposit() wraps native CFX, withdraw() unwraps it.

export const WCFX_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'wad', type: 'uint256' }],
    outputs: [],
  },
] as const;

/** Max uint256 — used as an unlimited approval amount for DCA jobs. */
export const MAX_UINT256 = 2n ** 256n - 1n;

export const AUTOMATION_MANAGER_ABI = [
  // ─── Custom Errors ─────────────────────────────────────────────────────────
  {
    type: 'error',
    name: 'DCACompleted',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
  },
  {
    type: 'error',
    name: 'DCAIntervalNotReached',
    inputs: [{ name: 'nextExecution', type: 'uint256' }],
  },
  { type: 'error', name: 'EnforcedPause', inputs: [] },
  { type: 'error', name: 'ExpectedPause', inputs: [] },
  {
    type: 'error',
    name: 'InvalidParams',
    inputs: [{ name: 'reason', type: 'string' }],
  },
  {
    type: 'error',
    name: 'JobExpiredError',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
  },
  {
    type: 'error',
    name: 'JobNotActive',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
  },
  {
    type: 'error',
    name: 'JobNotFound',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
  },
  {
    type: 'error',
    name: 'OwnableInvalidOwner',
    inputs: [{ name: 'owner', type: 'address' }],
  },
  {
    type: 'error',
    name: 'OwnableUnauthorizedAccount',
    inputs: [{ name: 'account', type: 'address' }],
  },
  {
    type: 'error',
    name: 'PriceConditionNotMet',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
  },
  { type: 'error', name: 'ReentrancyGuardReentrantCall', inputs: [] },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [{ name: 'token', type: 'address' }],
  },
  {
    type: 'error',
    name: 'SlippageTooHigh',
    inputs: [
      { name: 'requested', type: 'uint256' },
      { name: 'maxAllowed', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'TooManyJobs',
    inputs: [{ name: 'user', type: 'address' }],
  },
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },

  // ─── Events ────────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'JobCreated',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'jobId', type: 'bytes32' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'jobType', type: 'uint8' },
    ],
  },

  // ─── createLimitOrder ──────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createLimitOrder',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'minAmountOut', type: 'uint256' },
          { name: 'targetPrice', type: 'uint256' },
          { name: 'triggerAbove', type: 'bool' },
        ],
      },
      { name: 'slippageBps', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
    ],
    outputs: [{ name: 'jobId', type: 'bytes32' }],
  },

  // ─── createDCAJob ──────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'createDCAJob',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountPerSwap', type: 'uint256' },
          { name: 'intervalSeconds', type: 'uint256' },
          { name: 'totalSwaps', type: 'uint256' },
          { name: 'swapsCompleted', type: 'uint256' },
          { name: 'nextExecution', type: 'uint256' },
        ],
      },
      { name: 'slippageBps', type: 'uint256' },
      { name: 'expiresAt', type: 'uint256' },
    ],
    outputs: [{ name: 'jobId', type: 'bytes32' }],
  },

  // ─── cancelJob ─────────────────────────────────────────────────────────────
  {
    type: 'function',
    name: 'cancelJob',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'jobId', type: 'bytes32' }],
    outputs: [],
  },

  // ─── JobCancelled event ────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'JobCancelled',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'jobId', type: 'bytes32' },
      { indexed: true, name: 'canceller', type: 'address' },
    ],
  },
] as const;
