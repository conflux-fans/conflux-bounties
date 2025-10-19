import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    eSpaceTestnet: {
      url: process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 71,
      gasPrice: "auto",
      timeout: 60000,
    },
    eSpaceMainnet: {
      url: process.env.CONFLUX_MAINNET_RPC || "https://evm.confluxrpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1030,
      gasPrice: "auto",
      timeout: 60000,
    },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 60000,
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
  coverage: {
    skipFiles: [
      "",
    ]
  }
};

export default config;