import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import "@openzeppelin/hardhat-upgrades";
import "solidity-coverage";
import "dotenv/config";

import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
    paths: {
        tests: "./test",
    },
    mocha: {
        parallel: false,
    },
    solidity: {
        version: "0.8.26",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        confluxTestnet: {
            url: process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 71,
        },
        confluxMainnet: {
            url: process.env.CONFLUX_RPC_URL || "https://evm.confluxrpc.com",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 1030,
        },
    },
    etherscan: {
        apiKey: {
            confluxTestnet: "conflux",
            confluxMainnet: "conflux",
        },
        customChains: [
            {
                network: "confluxTestnet",
                chainId: 71,
                urls: {
                    apiURL: "https://evmapi-testnet.confluxscan.org/api/",
                    browserURL: "https://evmtestnet.confluxscan.org/",
                },
            },
            {
                network: "confluxMainnet",
                chainId: 1030,
                urls: {
                    apiURL: "https://evmapi.confluxscan.org/api/",
                    browserURL: "https://evm.confluxscan.org/",
                },
            },
        ],
    },
    gasReporter: {
        enabled: true,
        currency: "USD",
    },
};

export default config;
