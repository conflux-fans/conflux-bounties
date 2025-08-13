const { ethers } = require("hardhat");

async function main() {
  console.log("Checking transaction status on eSpace Testnet...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer address:", deployerAddress);
  
  // Get current nonce and check for pending transactions
  const nonce = await deployer.provider.getTransactionCount(deployerAddress, "latest");
  const pendingNonce = await deployer.provider.getTransactionCount(deployerAddress, "pending");
  console.log("Current nonce (latest):", nonce);
  console.log("Current nonce (pending):", pendingNonce);
  
  if (pendingNonce > nonce) {
    console.log(`⚠️  There are ${pendingNonce - nonce} pending transactions`);
    
    // Check the latest block to see if any transactions were mined
    const latestBlock = await deployer.provider.getBlock("latest");
    console.log("Latest block number:", latestBlock.number);
    console.log("Latest block timestamp:", new Date(latestBlock.timestamp * 1000).toISOString());
    
    // Try to get transaction receipt for the pending nonce
    for (let i = nonce; i < pendingNonce; i++) {
      try {
        const tx = await deployer.provider.getTransaction(deployerAddress, i);
        if (tx) {
          console.log(`\nTransaction at nonce ${i}:`);
          console.log("Hash:", tx.hash);
          console.log("Gas Price:", ethers.formatUnits(tx.gasPrice, "gwei"), "gwei");
          console.log("Gas Limit:", tx.gasLimit.toString());
          console.log("Status: Pending");
          
          // Try to get receipt
          try {
            const receipt = await deployer.provider.getTransactionReceipt(tx.hash);
            if (receipt) {
              console.log("Status: Mined in block", receipt.blockNumber);
              console.log("Gas Used:", receipt.gasUsed.toString());
            }
          } catch (error) {
            console.log("Receipt not available yet");
          }
        }
      } catch (error) {
        console.log(`Could not get transaction at nonce ${i}:`, error.message);
      }
    }
    
    console.log("\n💡 Recommendations:");
    console.log("1. Wait for pending transactions to be mined");
    console.log("2. Use a higher gas price for new deployment");
    console.log("3. Or wait and try again later");
    
  } else {
    console.log("✅ No pending transactions. Safe to deploy.");
  }
  
  // Check account balance
  const balance = await deployer.provider.getBalance(deployerAddress);
  console.log("\nAccount balance:", ethers.formatEther(balance), "CFX");
  
  // Get current gas price
  const gasPrice = await deployer.provider.getFeeData();
  console.log("Current gas price:", ethers.formatUnits(gasPrice.gasPrice, "gwei"), "gwei");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  }); 