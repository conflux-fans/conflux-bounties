import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

// ─── Key validation ─────────────────────────────────────────────────────────
const HARDHAT_DEFAULT_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY ?? HARDHAT_DEFAULT_KEY;

if (DEPLOYER_PRIVATE_KEY === HARDHAT_DEFAULT_KEY) {
  // Detected at config-load time so Hardhat surfaces it before spending gas.
  // Hard-fail for mainnet; loud warning for any live network.
  const argv = process.argv.join(' ');
  if (argv.includes('espaceMainnet')) {
    console.error('\n🚨  DEPLOYER_PRIVATE_KEY is not set (Hardhat default key detected).\n    Set it in .env before deploying to mainnet.\n');
    process.exit(1);
  } else if (!argv.includes('hardhat') && !argv.includes('test') && !argv.includes('compile') && !argv.includes('check-wallet')) {
    console.warn('\n⚠️   DEPLOYER_PRIVATE_KEY not set — using Hardhat test key. Do NOT use on mainnet.\n');
  }
}

// ─── RPC endpoints (env-overridable) ────────────────────────────────────────
const TESTNET_RPC = process.env.CONFLUX_ESPACE_TESTNET_RPC ?? 'https://evmtestnet.confluxrpc.com';
const MAINNET_RPC = process.env.CONFLUX_ESPACE_MAINNET_RPC  ?? 'https://evm.confluxrpc.com';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    espaceTestnet: {
      url: TESTNET_RPC,
      chainId: 71,
      accounts: [DEPLOYER_PRIVATE_KEY],
      timeout: 120_000,
    },
    espaceMainnet: {
      url: MAINNET_RPC,
      chainId: 1030,
      accounts: [DEPLOYER_PRIVATE_KEY],
      timeout: 180_000,
      gasMultiplier: 1.2,
    },
  },
  // ─── Sourcify verification (handles viaIR correctly) ─────────────────────
  sourcify: {
    enabled: true,
  },
  // ─── ConfluxScan verification ─────────────────────────────────────────────
  // Register Conflux eSpace chains so hardhat-verify can submit to ConfluxScan.
  // Obtain a free API key at https://evmapi.confluxscan.io/
  // Falls back to 'no-key' which still works for source verification.
  etherscan: {
    apiKey: {
      espaceMainnet: process.env.CONFLUXSCAN_API_KEY ?? 'no-key',
      espaceTestnet: process.env.CONFLUXSCAN_API_KEY ?? 'no-key',
    },
    customChains: [
      {
        network: 'espaceMainnet',
        chainId: 1030,
        urls: {
          apiURL: 'https://evmapi.confluxscan.org/api',
          browserURL: 'https://evm.confluxscan.org',
        },
      },
      {
        network: 'espaceTestnet',
        chainId: 71,
        urls: {
          apiURL: 'https://evmapi-testnet.confluxscan.org/api',
          browserURL: 'https://evmtestnet.confluxscan.org',
        },
      },
    ],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: './typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
