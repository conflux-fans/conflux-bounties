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
      url: process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com",
      chainId: 71,
      accounts: process.env.SERVICE_WALLET_KEY
        ? [process.env.SERVICE_WALLET_KEY]
        : [],
    },
    confluxMainnet: {
      url: process.env.CONFLUX_RPC_URL || "https://evm.confluxrpc.com",
      chainId: 1030,
      accounts: process.env.SERVICE_WALLET_KEY
        ? [process.env.SERVICE_WALLET_KEY]
        : [],
    },
  },
};

export default config;
