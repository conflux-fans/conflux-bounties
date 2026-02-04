import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "dotenv/config";

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    eSpaceTestnet: {
      url: process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 71,
    },
    eSpaceMainnet: {
      url: process.env.CONFLUX_MAINNET_RPC || "https://evm.confluxrpc.com",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 1030,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
