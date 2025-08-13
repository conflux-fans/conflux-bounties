const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying TokenVestingFactory to Sepolia...");
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", await deployer.getAddress());
  console.log("Account balance:", (await deployer.provider.getBalance(await deployer.getAddress())).toString());
  
  // Get current gas price and estimate deployment cost
  const gasPrice = await deployer.provider.getFeeData();
  console.log("Current gas price:", ethers.formatUnits(gasPrice.gasPrice, "gwei"), "gwei");
  
  // Use a more aggressive gas price increase to avoid replacement transaction issues
  const adjustedGasPrice = (gasPrice.gasPrice * 150n) / 100n; // 50% increase
  console.log("Adjusted gas price:", ethers.formatUnits(adjustedGasPrice, "gwei"), "gwei");
  
  // Get current nonce and check for pending transactions
  const nonce = await deployer.provider.getTransactionCount(await deployer.getAddress(), "latest");
  const pendingNonce = await deployer.provider.getTransactionCount(await deployer.getAddress(), "pending");
  console.log("Current nonce (latest):", nonce);
  console.log("Current nonce (pending):", pendingNonce);
  
  if (pendingNonce > nonce) {
    console.log("⚠️  Warning: There are pending transactions. Using pending nonce.");
    const finalNonce = pendingNonce;
    console.log("Using nonce:", finalNonce);
  }
  
  const TokenVestingFactory = await ethers.getContractFactory("TokenVestingFactory");
  
  // Try to estimate gas more reliably
  let estimatedGas;
  try {
    // Method 1: Try to estimate gas from the contract factory
    estimatedGas = await TokenVestingFactory.deploy().deploymentTransaction().gasLimit;
    console.log("Gas estimation method 1 (factory):", estimatedGas.toString());
  } catch (error) {
    console.log("Gas estimation method 1 failed, trying alternative...");
    
    try {
      // Method 2: Try to estimate gas using the deployment data
      const deploymentData = TokenVestingFactory.bytecode;
      estimatedGas = await deployer.provider.estimateGas({
        from: await deployer.getAddress(),
        data: deploymentData,
        nonce: pendingNonce > nonce ? pendingNonce : nonce,
      });
      console.log("Gas estimation method 2 (deployment data):", estimatedGas.toString());
    } catch (error2) {
      console.log("Gas estimation method 2 failed, using default values...");
      // Method 3: Use conservative default values based on contract complexity
      estimatedGas = ethers.parseUnits("800000", "wei"); // 800k gas as conservative estimate
      console.log("Using conservative gas estimate:", estimatedGas.toString());
    }
  }
  
  // Add safety buffer to gas estimate (20% buffer)
  const gasLimit = (estimatedGas * 120n) / 100n;
  
  const estimatedCost = gasLimit * adjustedGasPrice;
  console.log("Final gas limit (with 20% buffer):", gasLimit.toString());
  console.log("Estimated deployment cost:", ethers.formatEther(estimatedCost), "ETH");
  
  // Deploy with proper gas settings and nonce
  const factory = await TokenVestingFactory.deploy({
    gasLimit: gasLimit,
    gasPrice: adjustedGasPrice,
    nonce: pendingNonce > nonce ? pendingNonce : nonce,
  });
  
  console.log("TokenVestingFactory deployment transaction hash:", factory.deploymentTransaction().hash);
  
  await factory.waitForDeployment();
  
  const factoryAddress = await factory.getAddress();
  console.log("✅ TokenVestingFactory deployed to:", factoryAddress);
  
  // Get implementation addresses
  const tokenImpl = await factory.tokenImplementation();
  const vestingImpl = await factory.vestingImplementation();
  
  console.log("Token Implementation:", tokenImpl);
  console.log("Vesting Implementation:", vestingImpl);
  
  // Verify the deployment
  console.log("\n🔍 Verifying deployment...");
  try {
    await factory.waitForDeployment();
    const code = await deployer.provider.getCode(factoryAddress);
    if (code === "0x") {
      console.log("❌ Contract deployment failed - no bytecode at address");
    } else {
      console.log("✅ Contract deployment verified successfully");
    }
  } catch (error) {
    console.log("⚠️  Could not verify deployment:", error.message);
  }
  
  console.log("\n📋 Deployment Summary:");
  console.log("Network: Sepolia Testnet");
  console.log("Factory Address:", factoryAddress);
  console.log("Deployer:", await deployer.getAddress());
  console.log("Block Number:", await deployer.provider.getBlockNumber());
  console.log("Gas Used:", estimatedGas.toString());
  console.log("Gas Limit (with buffer):", gasLimit.toString());
  console.log("Total Cost:", ethers.formatEther(estimatedCost), "ETH");
  
  return factoryAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 