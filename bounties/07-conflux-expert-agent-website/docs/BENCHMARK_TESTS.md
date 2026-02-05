# Benchmark Test Questions

These 10 questions test the RAG system's ability to retrieve and answer Conflux-related questions accurately.

## Test Cases

### 1. Running a Node
**Question:** How do I run a Conflux node?
**Expected:** Instructions about downloading conflux-rust, configuring hydra.toml, system requirements

### 2. eSpace vs Core Space  
**Question:** What is the difference between eSpace and Core Space?
**Expected:** eSpace is EVM-compatible, Core Space uses CFX addresses, different address formats

### 3. Gas Fees
**Question:** How are gas fees calculated in Conflux eSpace?
**Expected:** Information about gas price, gas limit, sponsor mechanism

### 4. Smart Contract Deployment
**Question:** How do I deploy a smart contract on Conflux eSpace?
**Expected:** Use Hardhat/Remix, configure for eSpace RPC, similar to Ethereum

### 5. CFX Token
**Question:** What is CFX used for in Conflux?
**Expected:** Gas fees, staking, governance, storage collateral

### 6. Wallet Setup
**Question:** How do I set up Fluent Wallet?
**Expected:** Download from official site, create/import account, connect to eSpace/Core

### 7. Conflux PoS
**Question:** How does Proof of Stake work in Conflux?
**Expected:** Hybrid PoW/PoS, finality confirmation, staking requirements

### 8. Cross-Space Transfer
**Question:** How do I transfer assets between eSpace and Core Space?
**Expected:** Use built-in bridge, CrossSpaceCall contract, gas considerations

### 9. Developer RPC
**Question:** What is the RPC endpoint for Conflux eSpace mainnet?
**Expected:** https://evm.confluxrpc.com, chain ID 1030

### 10. Storage Collateral
**Question:** What is storage collateral in Conflux?
**Expected:** CFX locked when storing data on-chain, refundable when data deleted

## Running Tests

Use the search CLI to test retrieval:

```bash
npm run search "How do I run a Conflux node"
npm run search "What is the difference between eSpace and Core Space"
# ... etc
```

Or test via the chat UI at http://localhost:3000/chat

## Evaluation Criteria

- ✅ Answer contains relevant information from docs
- ✅ Citations point to correct source URLs
- ✅ Response is coherent and accurate
- ✅ No hallucinated information
