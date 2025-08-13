# Token Vesting Factory Deployment

This project contains deployment scripts for the TokenVestingFactory contract on multiple networks with enhanced features.

## Prerequisites

- Node.js and npm installed
- Hardhat configured
- Private key with sufficient funds for deployment
- Environment variables configured

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```bash
# Private key for deployment (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# eSpace Testnet RPC URL
ESPACE_TESTNET_URL=https://evmtestnet.confluxrpc.com

# Sepolia Testnet RPC URL (Infura, Alchemy, or your own node)
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_project_id

# Etherscan API key for contract verification (optional)
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## Installation

```bash
npm install
```

## Deployment

### Deploy to eSpace Testnet

```bash
npm run deploy:eSpaceTestnet
```

**Requirements**: ~10 CFX for gas fees

### Deploy to Sepolia Testnet

```bash
npm run deploy:sepolia
```

**Requirements**: ~0.02 ETH for gas fees

## Enhanced Features

Both deployment scripts include:
- 🔍 **Smart gas estimation** with fallback methods
- 📊 **Real-time cost calculation** before deployment
- ⚡ **Gas price optimization** to avoid transaction issues
- 🔄 **Nonce management** to prevent conflicts
- ✅ **Deployment verification** and detailed logging
- 📝 **Comprehensive deployment summary**

## Network Information

### eSpace Testnet
- Chain ID: 71
- RPC URL: https://evmtestnet.confluxrpc.com
- Explorer: https://evmtestnet.confluxscan.org
- Native Token: CFX
- Faucet: https://efaucet.confluxnetwork.org/

### Sepolia Testnet
- Chain ID: 11155111
- RPC URL: https://sepolia.infura.io/v3/your_project_id
- Explorer: https://sepolia.etherscan.io
- Native Token: ETH
- Faucet: https://sepoliafaucet.com/

## Contract Verification

After deployment, you can verify your contracts on the respective block explorers:

- **eSpace Testnet**: Use the custom chain configuration in hardhat.config.js
- **Sepolia**: Use Etherscan with your API key

## Troubleshooting

1. **Insufficient funds**: Ensure your deployer account has enough native tokens for gas fees
2. **RPC connection issues**: Check your RPC URL and ensure it's accessible
3. **Private key format**: Make sure your private key doesn't include the "0x" prefix
4. **Network configuration**: Verify the network configuration in hardhat.config.js matches your target network
5. **Gas estimation issues**: The scripts now handle this automatically with multiple fallback methods

## Recent Deployments

### Sepolia Testnet
- **Factory**: `0x67744D88052732aCcc242AF0AA453FADD0b44Eb8`
- **Token Implementation**: `0x2CB4c1C08362b65CAd0b304d1e45Ffa98f55eDD3`
- **Vesting Implementation**: `0xbD5Cc26cC1c6808CEf03Ae0F3CFE6d19c3772230`

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).
