/**
 * CAS Deployment Script — viem + @cfxdevkit/sdk
 *
 * Deploys the three CAS contracts to Conflux eSpace without Hardhat:
 *   1. SwappiPriceAdapter (router + factory + owner)
 *   2. AutomationManager  (priceAdapter + owner)
 *   3. PermitHandler      (no constructor args)
 *
 * Usage:
 *   NETWORK=mainnet pnpm deploy          # mainnet
 *   NETWORK=testnet pnpm deploy          # testnet (default)
 *
 * Required env vars (in root .env):
 *   DEPLOYER_PRIVATE_KEY   — 0x-prefixed private key
 *   NETWORK                — "mainnet" | "testnet" (default: testnet)
 *
 * Optional:
 *   CONFLUX_ESPACE_MAINNET_RPC / CONFLUX_ESPACE_TESTNET_RPC — override RPC URL
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  automationManagerAbi,
  automationManagerBytecode,
  permitHandlerAbi,
  permitHandlerBytecode,
  swappiPriceAdapterAbi,
  swappiPriceAdapterBytecode,
} from '@cfxdevkit/sdk/automation';
import type { ChainConfig } from '@cfxdevkit/sdk/config';
import { EVM_MAINNET, EVM_TESTNET, toViemChain } from '@cfxdevkit/sdk/config';
import * as dotenv from 'dotenv';
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ─── Load env ────────────────────────────────────────────────────────────────
dotenv.config({ path: resolve(import.meta.dirname, '../../.env') });

// ─── Swappi V2 production addresses ──────────────────────────────────────────
const SWAPPI: Record<
  string,
  { router: `0x${string}`; factory: `0x${string}` }
> = {
  mainnet: {
    router: '0xE37B52296b0bAA91412cD0Cd97975B0805037B84',
    factory: '0xe2a6f7c0ce4d5d300f97aa7e125455f5cd3342f5',
  },
  testnet: {
    router: '0x873789aaF553FD0B4252d0D2b72C6331c47aff2E',
    factory: '0x36B83E0D41D1dd9C73a006F0c1cbC1F096E69E34',
  },
};

const MIN_CFX: Record<string, number> = { mainnet: 0.5, testnet: 0.1 };

// ─── Config ───────────────────────────────────────────────────────────────────
const networkKey = (process.env.NETWORK ?? 'testnet').toLowerCase();
if (!['mainnet', 'testnet'].includes(networkKey)) {
  console.error(
    `❌  Unknown NETWORK="${networkKey}". Use "mainnet" or "testnet".`
  );
  process.exit(1);
}

const privateKey = process.env.DEPLOYER_PRIVATE_KEY as
  | `0x${string}`
  | undefined;
if (!privateKey) {
  console.error('❌  DEPLOYER_PRIVATE_KEY is not set in .env');
  process.exit(1);
}
if (
  privateKey ===
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
) {
  if (networkKey === 'mainnet') {
    console.error(
      '🚨  DEPLOYER_PRIVATE_KEY is the Hardhat default key — refusing to deploy to mainnet.'
    );
    process.exit(1);
  }
  console.warn(
    '⚠️   DEPLOYER_PRIVATE_KEY is the Hardhat default key. Do NOT use on mainnet.'
  );
}

const chainConfig: ChainConfig =
  networkKey === 'mainnet' ? EVM_MAINNET : EVM_TESTNET;
const rpcEnvKey =
  networkKey === 'mainnet'
    ? 'CONFLUX_ESPACE_MAINNET_RPC'
    : 'CONFLUX_ESPACE_TESTNET_RPC';
const rpcUrl = process.env[rpcEnvKey] ?? chainConfig.rpcUrls.default.http[0];
const viemChain = toViemChain(chainConfig);
const swappi = SWAPPI[networkKey];

// ─── Clients ──────────────────────────────────────────────────────────────────
const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);

const publicClient = createPublicClient({ chain: viemChain, transport });
const walletClient = createWalletClient({
  account,
  chain: viemChain,
  transport,
});

// ─── Helper: deploy + wait for receipt ───────────────────────────────────────
async function deployContract<T extends readonly unknown[]>(
  label: string,
  abi: unknown[],
  bytecode: `0x${string}`,
  args: T
): Promise<`0x${string}`> {
  console.log(`\n[→] Deploying ${label}…`);
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: args as unknown[],
  });
  console.log(`    tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress)
    throw new Error(`${label}: no contractAddress in receipt`);
  console.log(`    ✔  ${label}: ${receipt.contractAddress}`);
  return receipt.contractAddress;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== CAS Deploy — Conflux eSpace ${networkKey} ===`);
  console.log(`Chain:    ${viemChain.name} (${viemChain.id})`);
  console.log(`RPC:      ${rpcUrl}`);
  console.log(`Deployer: ${account.address}`);

  const balance = await publicClient.getBalance({ address: account.address });
  const balanceCFX = parseFloat(formatEther(balance));
  console.log(`Balance:  ${balanceCFX.toFixed(4)} CFX`);

  const min = MIN_CFX[networkKey];
  if (balanceCFX < min) {
    console.error(
      `\n❌  Insufficient balance (${balanceCFX.toFixed(4)} CFX). Minimum for ${networkKey}: ${min} CFX`
    );
    console.error(`   Fund the deployer wallet: ${account.address}`);
    process.exit(1);
  }

  // 1. SwappiPriceAdapter
  const priceAdapterAddress = await deployContract(
    'SwappiPriceAdapter',
    swappiPriceAdapterAbi as unknown[],
    swappiPriceAdapterBytecode as `0x${string}`,
    [swappi.router, swappi.factory, account.address] as const
  );

  // 2. AutomationManager
  const automationManagerAddress = await deployContract(
    'AutomationManager',
    automationManagerAbi as unknown[],
    automationManagerBytecode as `0x${string}`,
    [priceAdapterAddress, account.address] as const
  );

  // 3. PermitHandler
  const permitHandlerAddress = await deployContract(
    'PermitHandler',
    permitHandlerAbi as unknown[],
    permitHandlerBytecode as `0x${string}`,
    [] as const
  );

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log('\n=== Deployment Summary ===');
  console.log(
    JSON.stringify(
      {
        network: networkKey,
        chainId: viemChain.id,
        deployer: account.address,
        SwappiPriceAdapter: priceAdapterAddress,
        AutomationManager: automationManagerAddress,
        PermitHandler: permitHandlerAddress,
      },
      null,
      2
    )
  );

  // ─── Write deployments.json ───────────────────────────────────────────────
  const deploymentsPath = resolve(
    import.meta.dirname,
    '../../conflux-contracts/deployments.json'
  );
  let registry: Record<string, Record<string, string>> = {};
  try {
    registry = JSON.parse(readFileSync(deploymentsPath, 'utf-8'));
  } catch {
    /* new file */
  }
  registry[String(viemChain.id)] = {
    AutomationManager: automationManagerAddress,
    SwappiPriceAdapter: priceAdapterAddress,
    PermitHandler: permitHandlerAddress,
  };
  writeFileSync(deploymentsPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(
    `\n✔  Updated conflux-contracts/deployments.json (chain ${viemChain.id})`
  );
  console.log(
    '   Run `pnpm contracts:generate` to bake addresses into the SDK.'
  );

  // ─── .env snippet ─────────────────────────────────────────────────────────
  const isMainnet = networkKey === 'mainnet';
  console.log('\n=== Add to conflux-cas/.env ===');
  console.log(`AUTOMATION_MANAGER_ADDRESS=${automationManagerAddress}`);
  console.log(`PRICE_ADAPTER_ADDRESS=${priceAdapterAddress}`);
  console.log(`PERMIT_HANDLER_ADDRESS=${permitHandlerAddress}`);
  console.log(
    `NEXT_PUBLIC_AUTOMATION_MANAGER_ADDRESS=${automationManagerAddress}`
  );
  if (isMainnet) {
    console.log(`NETWORK=mainnet`);
    console.log(`NEXT_PUBLIC_NETWORK=mainnet`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
