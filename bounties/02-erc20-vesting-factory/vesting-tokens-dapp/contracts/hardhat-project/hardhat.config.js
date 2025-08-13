require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-ignition");
// require("@nomicfoundation/hardhat-foundry");
require("dotenv/config");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    espaceTestnet: {
      url: process.env.ESPACE_TESTNET_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://sepolia.infura.io/v3/46b505ffcd8c4bf68c49e95b77da3813",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  sourcify: {
    enabled: false,
  },
  etherscan: {
    apiKey: {
      espaceTestnet: 'espace',
      sepolia: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: 'espaceTestnet',
        chainId: 71,
        urls: {
          apiURL: 'https://evmapi-testnet.confluxscan.org/api/',
          browserURL: 'https://evmtestnet.confluxrpc.com/',
        },
      },
    ],
  },
};
