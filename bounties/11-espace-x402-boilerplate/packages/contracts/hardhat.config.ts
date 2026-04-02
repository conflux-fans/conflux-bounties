import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";
dotenvConfig({ path: resolve(__dirname, "../../.env") });

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    confluxTestnet: {
      url: "https://evmtestnet.confluxrpc.com",
      chainId: 71,
      accounts: process.env.DEPLOYER_WALLET_KEY
        ? [process.env.DEPLOYER_WALLET_KEY]
        : [],
    },
    confluxMainnet: {
      url: "https://evm.confluxrpc.com",
      chainId: 1030,
      accounts: process.env.DEPLOYER_WALLET_KEY
        ? [process.env.DEPLOYER_WALLET_KEY]
        : [],
    },
  },
};

export default config;
