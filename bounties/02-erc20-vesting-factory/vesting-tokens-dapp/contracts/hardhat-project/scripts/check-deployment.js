const { ethers } = require("hardhat");

async function main() {
  const txHash = "0xbdae5534f82b8a06ba0bc80751786ae1a76c9bf8603563342634d4488e31250f";
  
  console.log("Checking deployment transaction status...");
  console.log("Transaction Hash:", txHash);
  
  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider;
  
  try {
    // Get transaction details
    const tx = await provider.getTransaction(txHash);
    if (tx) {
      console.log("✅ Transaction found");
      console.log("From:", tx.from);
      console.log("To:", tx.to);
      console.log("Gas Price:", ethers.formatUnits(tx.gasPrice, "gwei"), "gwei");
      console.log("Gas Limit:", tx.gasLimit.toString());
      console.log("Nonce:", tx.nonce);
    }
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      console.log("\n🎉 Transaction mined successfully!");
      console.log("Block Number:", receipt.blockNumber);
      console.log("Gas Used:", receipt.gasUsed.toString());
      console.log("Status:", receipt.status === 1 ? "Success" : "Failed");
      
      if (receipt.status === 1) {
        // Transaction successful, get the deployed contract address
        const factoryAddress = receipt.contractAddress;
        console.log("\n📋 Deployment Summary:");
        console.log("Network: eSpace Testnet");
        console.log("Factory Address:", factoryAddress);
        console.log("Deployer:", tx.from);
        console.log("Block Number:", receipt.blockNumber);
        console.log("Gas Used:", receipt.gasUsed.toString());
        
        // Try to get implementation addresses
        try {
          const factory = await ethers.getContractAt("TokenVestingFactory", factoryAddress);
          const tokenImpl = await factory.tokenImplementation();
          const vestingImpl = await factory.vestingImplementation();
          
          console.log("\nImplementation Addresses:");
          console.log("Token Implementation:", tokenImpl);
          console.log("Vesting Implementation:", vestingImpl);
        } catch (error) {
          console.log("Could not get implementation addresses:", error.message);
        }
      }
    } else {
      console.log("\n⏳ Transaction not yet mined. Checking status...");
      
      // Check if transaction is still pending
      const pendingNonce = await provider.getTransactionCount(tx.from, "pending");
      const latestNonce = await provider.getTransactionCount(tx.from, "latest");
      
      console.log("Latest nonce:", latestNonce);
      console.log("Pending nonce:", pendingNonce);
      
      if (pendingNonce > latestNonce) {
        console.log("Transaction is still pending. Please wait...");
      } else {
        console.log("Transaction may have been dropped. Check the hash on the explorer.");
      }
    }
    
  } catch (error) {
    console.error("❌ Error checking transaction:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  }); 