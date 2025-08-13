# Deployment Guide

## Environment Setup

Before deploying, you need to set up your environment variables. Create a `.env` file in the root directory with the following variables:

```bash
# Private key for deployment (without 0x prefix)
PRIVATE_KEY=your_private_key_here

# eSpace Testnet RPC URL
ESPACE_TESTNET_RPC_URL=https://evmtestnet.confluxrpc.com


# Sepolia Testnet RPC URL
# Options:
# - Infura: https://sepolia.infura.io/v3/YOUR_PROJECT_ID
# - Alchemy: https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
# - Your own node: http://localhost:8545
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/your_project_id

# Etherscan API key for contract verification (optional)
# Get one at: https://etherscan.io/apis
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## ⚠️ IMPORTANT: Getting Testnet Tokens

**You MUST have testnet tokens before deploying!** The deployment will fail with "insufficient funds" error if your account doesn't have enough tokens for gas fees.

### Sepolia Testnet ETH (Get Free Testnet ETH):

1. **[Alchemy Sepolia Faucet](https://sepoliafaucet.com/)** - Most reliable, gives 0.5 ETH
2. **[Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)** - Requires Infura account
3. **[Chainlink Faucet](https://faucets.chain.link/sepolia)** - Alternative option
4. **[Paradigm Faucet](https://faucet.paradigm.xyz/)** - Another reliable option

### eSpace Testnet CFX:

1. **[Conflux eSpace Testnet Faucet](https://efaucet.confluxnetwork.org/)** - Official Conflux faucet
2. **[Conflux Portal](https://portal.confluxnetwork.org/)** - Alternative faucet option

### How to Get Testnet Tokens:
1. **Copy your wallet address** (the one shown in deployment logs)
2. **Visit one of the faucets above**
3. **Paste your address** and request testnet tokens
4. **Wait for confirmation** (usually takes a few minutes)
5. **Verify balance** before attempting deployment

### Required Amount:
- **Sepolia**: Minimum 0.02 ETH (deployment costs ~0.006 ETH)
- **eSpace**: Minimum 10 CFX (deployment costs ~2-5 CFX)

## Deployment Commands

### Deploy to Sepolia Testnet
```bash
npm run deploy:sepolia
```

### Deploy to eSpace Testnet
```bash
npm run deploy:eSpaceTestnet
```

## Verification

After deployment, you can verify your contracts:

### Sepolia Verification
```bash
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

### eSpace Testnet Verification
The custom chain configuration in `hardhat.config.js` handles eSpace verification automatically.

## Common Issues

1. **"insufficient funds for gas * price + value"**: 
   - **Solution**: Get testnet tokens from a faucet
   - **Sepolia**: Need ~0.006 ETH for deployment
   - **eSpace**: Need ~2-5 CFX for deployment

2. **"replacement transaction underpriced"**: 
   - **Solution**: The script now handles this automatically with gas price adjustment
   - **Status**: ✅ Resolved

3. **"nonce too low"**: Wait for pending transactions or reset your account
4. **"gas estimation failed"**: Check your RPC URL and network connectivity
5. **"invalid private key"**: Ensure your private key doesn't include "0x" prefix
6. **"File @openzeppelin/contracts/security/ReentrancyGuard.sol not found"**: 
   - **Solution**: The import path has been fixed to use `utils/` instead of `security/`
   - **Status**: ✅ Resolved

## Network Details

| Network | Chain ID | RPC URL | Explorer | Faucet | Native Token |
|---------|----------|---------|----------|---------|--------------|
| Sepolia | 11155111 | https://sepolia.infura.io/v3/... | https://sepolia.etherscan.io | [Alchemy](https://sepoliafaucet.com/) | ETH |
| eSpace Testnet | 71 | https://evmtestnet.confluxrpc.com | https://evmtestnet.confluxscan.org | [Conflux](https://efaucet.confluxnetwork.org/) | CFX | 