# Pyth Oracle Integration Guide for Conflux eSpace

## Step 1: Understand the Architecture

Pyth Network provides high-frequency, low-latency price feeds. On Conflux eSpace (EVM-compatible), you interact with Pyth through a deployed contract that receives price updates via Verifiable Random Access (VRA) data.

```
┌──────────┐     VAA Data      ┌──────────┐     Price      ┌──────────────┐
│  Hermes  │ ────────────────> │  Pyth    │ ─────────────> │ Your Contract │
│  (API)   │                   │ Endpoint │                │              │
└──────────┘                   └──────────┘                └──────────────┘
     │                                                        │
     │ GET /api/latest_price_feeds                            │ Business Logic
     └────────────────────────────────────────────────────────┘
```

## Step 2: Set Up Your Project

```bash
# Install dependencies
npm install @pythnetwork/pyth-evm-js viem ethers

# For Hardhat development
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

## Step 3: Fetch Price Data Off-Chain

```javascript
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

const connection = new EvmPriceServiceConnection('https://xc-mainnet.pyth.network');

// Get price update data
const priceIds = [
  '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72fc6562aedb9', // BTC/USD
];

const priceFeeds = await connection.getLatestPriceFeeds(priceIds);
const updateData = await connection.getPriceFeedsUpdateData(priceIds);

console.log(priceFeeds[0].getPriceAsNumber()); // e.g., 67500.50
console.log(priceFeeds[0].getPrice()); // { price: "6750050000000", expo: -8 }
```

## Step 4: Use Price In Smart Contracts

```solidity
pragma solidity ^0.8.20;

interface IPyth {
    function getPrice(bytes32 id) external view returns (
        int64 price, uint64 conf, int32 expo, uint256 publishTime
    );
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256);
}

contract MyDeFiProtocol {
    IPyth public immutable pyth;
    bytes32 public btcPriceId;

    constructor(address _pyth, bytes32 _btcPriceId) {
        pyth = IPyth(_pyth);
        btcPriceId = _btcPriceId;
    }

    function executeWithPrice(bytes[] calldata updateData) external payable {
        // 1. Update price feeds
        uint256 fee = pyth.getUpdateFee(updateData);
        require(msg.value >= fee);
        pyth.updatePriceFeeds{value: fee}(updateData);

        // 2. Read price
        (int64 price,,,,) = pyth.getPrice(btcPriceId);
        // price has expo (usually -8), so 67500.50 = 6750050000000

        // 3. Your business logic
        require(price > 60000_0000_0000, "BTC too low!");
    }
}
```

## Step 5: Send Transaction from Frontend

```javascript
import { createPublicClient, createWalletClient, http } from 'viem';
import { confluxESpace } from 'viem/chains'; // or custom chain config

const PYTH_ENDPOINT = '0xe9e45c4a3f58d27ec491327000293359ff618e2f';

async function updatePriceAndExecute(walletClient, updateData) {
    const hash = await walletClient.writeContract({
        address: MY_CONTRACT,
        abi: [...],
        functionName: 'executeWithPrice',
        args: [updateData],
        value: BigInt(updateData.reduce((sum, d) => sum + d.length, 0) * 100),
    });
    return hash;
}
```

## Security Checklist

- [ ] Validate price staleness (`block.timestamp - publishTime < MAX_AGE`)
- [ ] Check confidence intervals (`conf / price < MAX_RATIO`)
- [ ] Use `updatePriceFeeds` before critical operations
- [ ] Handle reentrancy in price-dependent transfers
- [ ] Implement emergency pause circuit breaker
- [ ] Test with extreme price values (0, negative, overflow)
- [ ] Use fallback mechanism if Pyth is temporarily unavailable

## Common Pitfalls

1. **Forgetting to update price feeds** — Call `updatePriceFeeds` before reading
2. **Ignoring the exponent** — Price values have `expo` (usually -8), normalize them
3. **Not checking staleness** — Old prices can be manipulated
4. **Confidence too wide** — High uncertainty means unreliable price
5. **Wrong chain addresses** — Use Conflux eSpace specific Pyth endpoint

## Resources

- [Pyth Network Documentation](https://docs.pyth.network)
- [Pyth EVM SDK](https://github.com/pyth-network/pyth-evm-js)
- [Conflux eSpace Docs](https://developer.confluxnetwork.org/eSpace/overview)
- [Hermes API Reference](https://hermes.pyth.network)
