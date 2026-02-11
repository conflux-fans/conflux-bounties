import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'dotenv/config';

const RELAYER_KEY = process.env.RELAYER_PRIVATE_KEY || '0x' + '0'.repeat(64);

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'paris',
    },
  },
  networks: {
    'conflux-testnet': {
      url: 'https://evmtestnet.confluxrpc.com',
      chainId: 71,
      accounts: [RELAYER_KEY],
    },
    'conflux-mainnet': {
      url: 'https://evm.confluxrpc.com',
      chainId: 1030,
      accounts: [RELAYER_KEY],
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
