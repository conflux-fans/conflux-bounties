/**
 * check-wallet.ts
 *
 * Validates DEPLOYER_PRIVATE_KEY and prints the deployer address + CFX balance
 * on both testnet and mainnet. Run before deploying to confirm the account is
 * funded.
 *
 * Usage:
 *   pnpm --filter @conflux-cas/contracts check-wallet
 *
 * Runs via `hardhat run` so ethers is available without a separate install.
 * No --network flag needed — the script creates its own providers.
 */

// ethers v6 is provided by @nomicfoundation/hardhat-toolbox
import { ethers } from 'hardhat';

const HARDHAT_DEFAULT_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const NETWORKS = [
  {
    name: 'Testnet  (chainId  71)',
    rpcEnv: 'CONFLUX_ESPACE_TESTNET_RPC',
    rpcDefault: 'https://evmtestnet.confluxrpc.com',
    faucetHint: 'https://faucet.confluxnetwork.org/eSpace',
    minRecommended: 0.1,
  },
  {
    name: 'Mainnet  (chainId 1030)',
    rpcEnv: 'CONFLUX_ESPACE_MAINNET_RPC',
    rpcDefault: 'https://evm.confluxrpc.com',
    faucetHint: null,
    minRecommended: 0.5,
  },
];

async function getBalance(rpcUrl: string, address: string): Promise<bigint | null> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return await Promise.race<bigint | null>([
      provider.getBalance(address),
      new Promise<null>((_r, rej) => setTimeout(() => rej(new Error('timeout')), 5_000)),
    ]);
  } catch {
    return null;
  }
}

function fmt(wei: bigint): string {
  return `${parseFloat(ethers.formatEther(wei)).toFixed(4)} CFX`;
}

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║         Conflux CAS  –  Deployer Wallet          ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // 1. Validate key
  const rawKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!rawKey) {
    console.error('\n❌  DEPLOYER_PRIVATE_KEY is not set in .env\n');
    process.exit(1);
  }

  const key = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;

  if (key === HARDHAT_DEFAULT_KEY) {
    console.error('\n🚨  DEPLOYER_PRIVATE_KEY matches the well-known Hardhat test key.');
    console.error('    Anyone can drain this account. Set a real key in .env.\n');
    process.exit(1);
  }

  // 2. Derive address
  let wallet: ethers.Wallet;
  try {
    wallet = new ethers.Wallet(key);
  } catch {
    console.error('\n❌  DEPLOYER_PRIVATE_KEY is invalid (must be 0x-prefixed 32-byte hex).\n');
    process.exit(1);
  }

  console.log(`\n  Deployer address : ${wallet.address}\n`);

  // 3. Fetch balances on both networks in parallel
  const results = await Promise.all(
    NETWORKS.map(async (net) => {
      const rpcUrl = (process.env[net.rpcEnv] ?? net.rpcDefault) as string;
      const balance = await getBalance(rpcUrl, wallet.address);
      return { ...net, rpcUrl, balance };
    }),
  );

  // 4. Print table
  console.log('  Network                      Balance          Status');
  console.log('  ──────────────────────────── ──────────────── ──────');
  for (const r of results) {
    if (r.balance === null) {
      console.log(`  ${r.name}  ⚠️  RPC unreachable (${r.rpcUrl})`);
    } else {
      const val = parseFloat(ethers.formatEther(r.balance));
      const icon = val >= r.minRecommended ? '✅' : val > 0 ? '⚠️ ' : '❌';
      console.log(`  ${r.name}  ${fmt(r.balance).padEnd(16)} ${icon}`);
      if (val < r.minRecommended) {
        const faucet = r.faucetHint ? `  💧 ${r.faucetHint}` : '';
        console.log(`                              Minimum recommended: ${r.minRecommended} CFX${faucet}`);
      }
    }
  }

  console.log('');
  console.log('  Legend:  ✅ ready   ⚠️  low balance / unreachable   ❌ empty');
  console.log('');
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
