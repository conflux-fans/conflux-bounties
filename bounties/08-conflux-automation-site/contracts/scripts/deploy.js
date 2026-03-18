const hre = require("hardhat");

async function main() {
  console.log("Deploying contracts...");

  // Deploy PriceOracle
  const PriceOracle = await hre.ethers.getContractFactory("PriceOracle");
  const priceOracle = await PriceOracle.deploy();
  await priceOracle.waitForDeployment();
  const priceOracleAddress = await priceOracle.getAddress();
  console.log("PriceOracle deployed to:", priceOracleAddress);

  // Deploy JobManager
  const JobManager = await hre.ethers.getContractFactory("JobManager");
  const jobManager = await JobManager.deploy();
  await jobManager.waitForDeployment();
  const jobManagerAddress = await jobManager.getAddress();
  console.log("JobManager deployed to:", jobManagerAddress);

  // Add price oracle as updater
  console.log("\nSetting up roles...");
  const tx1 = await priceOracle.addUpdater(jobManagerAddress);
  await tx1.wait();
  console.log("Added JobManager as price updater");

  // Add deployer as initial executor (for testing)
  const [deployer] = await hre.ethers.getSigners();
  const tx2 = await jobManager.addExecutor(deployer.address);
  await tx2.wait();
  console.log("Added deployer as executor");

  console.log("\n✅ Deployment complete!");
  console.log("\nContract addresses:");
  console.log("  PriceOracle:", priceOracleAddress);
  console.log("  JobManager:", jobManagerAddress);
  
  console.log("\nSave these addresses to your .env file:");
  console.log(`  PRICE_ORACLE_ADDRESS=${priceOracleAddress}`);
  console.log(`  JOB_MANAGER_ADDRESS=${jobManagerAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
