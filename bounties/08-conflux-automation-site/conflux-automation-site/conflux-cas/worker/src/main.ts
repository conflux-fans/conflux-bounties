/**
 * Worker main entrypoint.
 *
 * Reads config from environment variables, wires together SafetyGuard,
 * PriceChecker, KeeperClientImpl, DbJobStore, Executor, and JobPoller,
 * then runs until SIGTERM/SIGINT.
 *
 * Usage:
 *   DATABASE_PATH=./data/cas.db \
 *   EXECUTOR_PRIVATE_KEY=0x... \
 *   AUTOMATION_MANAGER_ADDRESS=0x... \
 *   NETWORK=testnet \
 *   node dist/main.js
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load the root-level .env (two directories up from worker/src/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
// Also allow a local worker/.env to override individual keys
dotenv.config();

import { createPublicClient, http } from 'viem';
import { AuditLogger } from './audit-logger.js';
import { DbJobStore } from './db-job-store.js';
import { Executor } from './executor.js';
import { JobPoller } from './job-poller.js';
import { KeeperClientImpl } from './keeper-client.js';
import { logger } from './logger.js';
import type { PriceSource } from './price-checker.js';
import { PriceChecker } from './price-checker.js';
import { RetryQueue } from './retry-queue.js';
import { SafetyGuard } from './safety-guard.js';

// --------------------------------------------------------------------------
// Conflux eSpace chain definitions (viem)
// --------------------------------------------------------------------------

const CONFLUX_ESPACE_TESTNET = {
  id: 71,
  name: 'Conflux eSpace Testnet',
  network: 'conflux-espace-testnet',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evmtestnet.confluxrpc.com'] },
    public: { http: ['https://evmtestnet.confluxrpc.com'] },
  },
} as const;

const CONFLUX_ESPACE_MAINNET = {
  id: 1030,
  name: 'Conflux eSpace',
  network: 'conflux-espace',
  nativeCurrency: { name: 'CFX', symbol: 'CFX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://evm.confluxrpc.com'] },
    public: { http: ['https://evm.confluxrpc.com'] },
  },
} as const;

const SWAPPI_ROUTER = {
  testnet: '0x873789aaf553fd0b4252d0d2b72c6331c47aff2e',
  mainnet: '0xE37B52296b0bAA91412cD0Cd97975B0805037B84', // Swappi v2 router — confirmed deployed on mainnet (router.factory()=0xe2a6f7c0...)
} as const;

// --------------------------------------------------------------------------
// Config from env
// --------------------------------------------------------------------------

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Required environment variable ${key} is not set`);
  return val;
}

function getConfig() {
  const network = (process.env.NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new Error(`NETWORK must be 'testnet' or 'mainnet', got: ${network}`);
  }

  const rawDbPath = process.env.DATABASE_PATH ?? './data/cas.db';
  // Resolve relative paths from the project root (worker/src → ../../)
  const databasePath = path.isAbsolute(rawDbPath)
    ? rawDbPath
    : path.resolve(__dirname, '../..', rawDbPath);

  return {
    network,
    databasePath,
    executorPrivateKey: requireEnv('EXECUTOR_PRIVATE_KEY') as `0x${string}`,
    contractAddress: requireEnv('AUTOMATION_MANAGER_ADDRESS') as `0x${string}`,
    rpcUrl:
      network === 'testnet'
        ? (process.env.CONFLUX_ESPACE_TESTNET_RPC ??
          'https://evmtestnet.confluxrpc.com')
        : (process.env.CONFLUX_ESPACE_MAINNET_RPC ??
          'https://evm.confluxrpc.com'),
    maxGasPriceGwei: BigInt(process.env.MAX_GAS_PRICE_GWEI ?? '1000'),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? '15000'),
    rpcTimeoutMs: Number(process.env.WORKER_RPC_TIMEOUT_MS ?? '120000'),
    dryRun: process.env.DRY_RUN === 'true',
  };
}

// --------------------------------------------------------------------------
// Real on-chain price source via Swappi (UniswapV2-compatible) router
// --------------------------------------------------------------------------

const SWAPPI_ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'address[]', name: 'path', type: 'address[]' },
    ],
    name: 'getAmountsOut',
    outputs: [
      { internalType: 'uint256[]', name: 'amounts', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function createSwappiPriceSource(
  publicClient: ReturnType<typeof createPublicClient>,
  routerAddress: `0x${string}`
): PriceSource {
  return {
    async getPrice(tokenIn: string, tokenOut: string): Promise<bigint> {
      let amounts: unknown;
      try {
        amounts = await publicClient.readContract({
          address: routerAddress,
          abi: SWAPPI_ROUTER_ABI,
          functionName: 'getAmountsOut',
          args: [
            1_000_000_000_000_000_000n,
            [tokenIn as `0x${string}`, tokenOut as `0x${string}`],
          ],
        });
      } catch (err) {
        // Contract reverts (e.g. pair does not exist, insufficient liquidity) and
        // transient RPC errors both land here.  Re-throw so the Executor's catch
        // block can increment the retry counter and update last_error in the DB —
        // silently returning 0 would leave the job looping forever with no UI
        // feedback.
        const reason = err instanceof Error ? err.message : String(err);
        logger.warn(
          { tokenIn, tokenOut, reason },
          '[SwappiPriceSource] getPrice failed — re-throwing for executor retry handling'
        );
        throw new Error(
          `getAmountsOut reverted for pair ${tokenIn}→${tokenOut}: ${reason}`
        );
      }
      return (amounts as bigint[])[1] ?? 0n;
    },
  };
}

// --------------------------------------------------------------------
// Boot
// --------------------------------------------------------------------------

async function main() {
  const config = getConfig();

  logger.info(
    { config: { ...config, executorPrivateKey: '[REDACTED]' } },
    '[main] starting worker'
  );

  const chain =
    config.network === 'testnet'
      ? CONFLUX_ESPACE_TESTNET
      : CONFLUX_ESPACE_MAINNET;

  // Wire up all components
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl),
  });
  const routerAddress = SWAPPI_ROUTER[config.network];
  const swappiPriceSource = createSwappiPriceSource(
    publicClient,
    routerAddress
  );

  const safetyGuard = new SafetyGuard({}, logger);
  const priceChecker = new PriceChecker(swappiPriceSource, new Map(), logger);
  const retryQueue = new RetryQueue({}, logger);
  const _auditLogger = new AuditLogger();

  const keeperClient = new KeeperClientImpl({
    rpcUrl: config.rpcUrl,
    privateKey: config.executorPrivateKey,
    contractAddress: config.contractAddress,
    swappiRouter: SWAPPI_ROUTER[config.network],
    maxGasPriceGwei: config.maxGasPriceGwei,
    chain,
    rpcTimeoutMs: config.rpcTimeoutMs,
  });

  const jobStore = new DbJobStore(config.databasePath);

  const executor = new Executor(
    priceChecker,
    safetyGuard,
    retryQueue,
    keeperClient,
    jobStore,
    {
      dryRun: config.dryRun,
    }
  );

  const poller = new JobPoller(executor, {
    intervalMs: config.pollIntervalMs,
    onTick: () => {
      // Sync pause flag from DB so backend pause/resume propagates to worker
      safetyGuard.updateConfig({ globalPause: jobStore.getPaused() });
      return jobStore.updateHeartbeat();
    },
  });

  // Start polling
  poller.start();
  logger.info(
    {
      network: config.network,
      dryRun: config.dryRun,
      pollIntervalMs: config.pollIntervalMs,
    },
    '[main] worker running'
  );

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '[main] shutting down');
    poller.stop();
    logger.info('[main] shutdown complete');
    process.exit(0);
  };

  // Security: refuse to run as root to avoid accidental privileged exec of RPC/keystore
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    logger.error('[main] refusing to run worker as root — please use an unprivileged user');
    process.exit(1);
  }

  // Global uncaught handlers for robust crash diagnostics
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, '[main] unhandledRejection');
    // allow file/console flush then exit
    setTimeout(() => process.exit(1), 100);
  });
  process.on('uncaughtException', (err) => {
    logger.error({ err }, '[main] uncaughtException');
    setTimeout(() => process.exit(1), 100);
  });

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  logger.error({ err }, '[main] fatal error');
  process.exit(1);
});
