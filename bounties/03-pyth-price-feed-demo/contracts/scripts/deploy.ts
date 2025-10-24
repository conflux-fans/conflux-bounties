import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

console.log("🔍 DEBUG INFO:");
console.log("Private Key exists:", !!process.env.PRIVATE_KEY);
console.log("Private Key length:", process.env.PRIVATE_KEY?.length || 0);
console.log("RPC URL:", process.env.CONFLUX_MAINNET_RPC || "not set");
console.log("─────────────────────────────────────────\n");

interface DeploymentAddresses {
  network: string;
  chainId: string;
  pythOracle: string;
  priceIds: {
    BTC: string;
    ETH: string;
    CFX: string;
  };
  contracts: {
    priceConsumer: string;
    betting: string;
    lending: string;
    feeManager: string;
    fallbackOracle: string;
  };
  deployer: string;
  timestamp: string;
}

async function main() {
  console.log("🚀 Starting deployment...\n");

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  
  if (!deployer) {
    throw new Error("No deployer account found. Check your hardhat.config.ts");
  }

  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);
  
  console.log("📋 Deployment Configuration:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Network:   ${network.name}`);
  console.log(`Chain ID:  ${network.chainId}`);
  console.log(`Deployer:  ${deployer.address}`);
  console.log(`Balance:   ${ethers.formatEther(balance)} CFX`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Pyth contract addresses
  const PYTH_TESTNET = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21"; 
  const PYTH_MAINNET = "0xe9d69CdD6Fe41e7B621B4A688C5D1a68cB5c8ADc";

  const pythAddress = network.chainId === 71n ? PYTH_TESTNET : PYTH_MAINNET;

  console.log(`Using Pyth Oracle at: ${pythAddress}\n`);

  // Pyth Price Feed IDs
  const PRICE_IDS = {
    BTC: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    CFX: "0x8879170230c9603342f3837cf9a8e76c61791198fb1271bb2552c9af7b33c933"
  };

  console.log("📊 Price Feed IDs:");
  console.log(`  BTC/USD: ${PRICE_IDS.BTC}`);
  console.log(`  ETH/USD: ${PRICE_IDS.ETH}`);
  console.log(`  CFX/USD: ${PRICE_IDS.CFX}\n`);

  const deployments: DeploymentAddresses = {
    network: network.name,
    chainId: network.chainId.toString(),
    pythOracle: pythAddress,
    priceIds: PRICE_IDS,
    contracts: {
      priceConsumer: "",
      betting: "",
      lending: "",
      feeManager: "",
      fallbackOracle: ""
    },
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  try {
    // 1. Deploy PriceConsumer
    console.log("1️⃣ Deploying PriceConsumer...");
    const PriceConsumer = await ethers.getContractFactory("PriceConsumer");
    const priceConsumer = await PriceConsumer.deploy(pythAddress);
    await priceConsumer.waitForDeployment();
    deployments.contracts.priceConsumer = await priceConsumer.getAddress();
    console.log(`✅ PriceConsumer: ${deployments.contracts.priceConsumer}\n`);

    // 2. Deploy PriceFeedBetting
    console.log("2️⃣ Deploying PriceFeedBetting...");
    const PriceFeedBetting = await ethers.getContractFactory("PriceFeedBetting");
    const betting = await PriceFeedBetting.deploy(pythAddress);
    await betting.waitForDeployment();
    deployments.contracts.betting = await betting.getAddress();
    console.log(`✅ PriceFeedBetting: ${deployments.contracts.betting}`);
    console.log(`   Supports: BTC, ETH, CFX price feeds\n`);

    // 3. Deploy MockLendingProtocol
    console.log("3️⃣ Deploying MockLendingProtocol...");
    const MockLendingProtocol = await ethers.getContractFactory("MockLendingProtocol");
    const lending = await MockLendingProtocol.deploy(pythAddress);
    await lending.waitForDeployment();
    deployments.contracts.lending = await lending.getAddress();
    console.log(`✅ MockLendingProtocol: ${deployments.contracts.lending}\n`);

    // Fund lending protocol
    console.log("💰 Funding lending protocol...");
    const fundTx = await deployer.sendTransaction({
      to: deployments.contracts.lending,
      value: ethers.parseEther("1"),
    });
    await fundTx.wait();
    console.log("✅ Funded with 1 CFX\n");

    // 4. Deploy DynamicFeeManager
    console.log("4️⃣ Deploying DynamicFeeManager...");
    const DynamicFeeManager = await ethers.getContractFactory("DynamicFeeManager");
    const feeManager = await DynamicFeeManager.deploy(pythAddress);
    await feeManager.waitForDeployment();
    deployments.contracts.feeManager = await feeManager.getAddress();
    console.log(`✅ DynamicFeeManager: ${deployments.contracts.feeManager}\n`);

    // 5. Deploy FallbackOracle
    console.log("5️⃣ Deploying FallbackOracle...");
    const FallbackOracle = await ethers.getContractFactory("FallbackOracle");
    const fallbackOracle = await FallbackOracle.deploy(pythAddress);
    await fallbackOracle.waitForDeployment();
    deployments.contracts.fallbackOracle = await fallbackOracle.getAddress();
    console.log(`✅ FallbackOracle: ${deployments.contracts.fallbackOracle}\n`);

    // Verify deployments
    console.log("🔍 Verifying deployments...");
    
    // Check betting contract owner
    const bettingOwner = await betting.owner();
    console.log(`  Betting owner: ${bettingOwner}`);
    
    // Check lending next position ID
    const nextPositionId = await lending.nextPositionId();
    console.log(`  Lending next position ID: ${nextPositionId}`);
    
    console.log("✅ Verification complete\n");

    // Save deployment info
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `${network.name}-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(deployments, null, 2));
    fs.writeFileSync(
      path.join(deploymentsDir, `${network.name}-latest.json`),
      JSON.stringify(deployments, null, 2)
    );

    // Generate frontend config
    const frontendConfig = {
      PYTH_ADDRESS: deployments.pythOracle,
      BETTING_ADDRESS: deployments.contracts.betting,
      LENDING_ADDRESS: deployments.contracts.lending,
      PRICE_CONSUMER_ADDRESS: deployments.contracts.priceConsumer,
      FEE_MANAGER_ADDRESS: deployments.contracts.feeManager,
      FALLBACK_ORACLE_ADDRESS: deployments.contracts.fallbackOracle,
      PRICE_IDS: deployments.priceIds,
    };

    fs.writeFileSync(
      path.join(deploymentsDir, `${network.name}-frontend.json`),
      JSON.stringify(frontendConfig, null, 2)
    );

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 DEPLOYMENT SUCCESSFUL");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n📝 Contract Addresses:");
    console.log(`Pyth Oracle:        ${deployments.pythOracle}`);
    console.log(`PriceConsumer:      ${deployments.contracts.priceConsumer}`);
    console.log(`PriceFeedBetting:   ${deployments.contracts.betting}`);
    console.log(`MockLendingProtocol:${deployments.contracts.lending}`);
    console.log(`DynamicFeeManager:  ${deployments.contracts.feeManager}`);
    console.log(`FallbackOracle:     ${deployments.contracts.fallbackOracle}`);
    console.log("\n📁 Deployment files:");
    console.log(`  Full:     ${filepath}`);
    console.log(`  Latest:   ${path.join(deploymentsDir, `${network.name}-latest.json`)}`);
    console.log(`  Frontend: ${path.join(deploymentsDir, `${network.name}-frontend.json`)}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("📋 Next Steps:");
    console.log("1. Update frontend config with addresses from frontend.json");
    console.log("2. Test betting with multiple assets (BTC, ETH, CFX)");
    console.log("3. Create lending positions");
    console.log("4. Verify contracts on block explorer\n");

  } catch (error: any) {
    console.error("\n❌ Deployment Error:");
    console.error(error.message);
    if (error.error) {
      console.error("Details:", error.error);
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Fatal Error:");
    console.error(error);
    process.exit(1);
  });