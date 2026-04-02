import { ethers } from "hardhat";

// Known mainnet ERC-3009 token addresses on Conflux eSpace (chain 1030)
// Verified on-chain: these contracts support receiveWithAuthorization + DOMAIN_SEPARATOR
const MAINNET_TOKENS = [
  "0xaf37e8b6c9ed7f6318979f56fc287d76c30847ff", // USDT0 (domain: name="USDT0", version="1")
  "0x70bfd7f7eadf9b9827541272589a6b2bb760ae2e", // AxCNH (domain: name="AxCNH", version="2")
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const isMainnet = Number(network.chainId) === 1030;

  console.log(`Deploying to ${isMainnet ? "MAINNET (chain 1030)" : "TESTNET (chain 71)"}`);
  console.log("Deploying with account:", deployer.address);

  // Seller wallets — read from env
  const seller1 = process.env.SERVICE_WALLET_ADDRESS;
  const seller1Key = process.env.SERVICE_WALLET_KEY;
  const seller2 = process.env.SERVICE_WALLET_ADDRESS_2;
  const seller2Key = process.env.SERVICE_WALLET_KEY_2;

  if (!seller1 || !seller1Key) {
    throw new Error("SERVICE_WALLET_ADDRESS and SERVICE_WALLET_KEY must be set in .env");
  }
  if (!seller2 || !seller2Key) {
    throw new Error("SERVICE_WALLET_ADDRESS_2 and SERVICE_WALLET_KEY_2 must be set in .env");
  }

  let tokenAddress: string;
  let tokenAddresses: string[];

  if (isMainnet) {
    // ─── Mainnet: use real USDT0/CNHT0, skip MockUSDT0 ───
    console.log("\n--- Mainnet: using real USDT0 + CNHT0 tokens ---");
    console.log("USDT0:", MAINNET_TOKENS[0]);
    console.log("CNHT0:", MAINNET_TOKENS[1]);
    tokenAddress = MAINNET_TOKENS[0]; // primary token
    tokenAddresses = MAINNET_TOKENS;
  } else {
    // ─── Testnet: deploy MockUSDT0 ───
    console.log("\n--- Deploying MockUSDT0 (testnet only) ---");
    const mockFactory = await ethers.getContractFactory("MockUSDT0");
    const mockToken = await mockFactory.deploy();
    await mockToken.waitForDeployment();
    tokenAddress = await mockToken.getAddress();
    tokenAddresses = [tokenAddress];
    console.log("MockUSDT0 deployed to:", tokenAddress);
  }

  // Deploy X402PaymentVerifier with supported tokens
  console.log("\n--- Deploying X402PaymentVerifier (multi-tenant) ---");
  const verifierFactory = await ethers.getContractFactory("X402PaymentVerifier");
  const verifier = await verifierFactory.deploy(tokenAddresses);
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("X402PaymentVerifier deployed to:", verifierAddress);

  // Register both sellers with 0 escrow (instant release)
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";

  // --- Seller 1 ---
  console.log(`\n--- Registering Seller 1: ${seller1} (0 escrow) ---`);
  const seller1Wallet = new ethers.Wallet(seller1Key, ethers.provider);
  const verifierAsSeller1 = verifier.connect(seller1Wallet);
  const tx1 = await verifierAsSeller1.registerSeller(apiBaseUrl, "x402 Seller (primary)", 0);
  await tx1.wait();
  console.log("Seller 1 registered:", seller1);

  // --- Seller 2 ---
  console.log(`\n--- Registering Seller 2: ${seller2} (0 escrow) ---`);
  const seller2Wallet = new ethers.Wallet(seller2Key, ethers.provider);
  const verifierAsSeller2 = verifier.connect(seller2Wallet);
  const tx2 = await verifierAsSeller2.registerSeller(apiBaseUrl, "x402 Seller (instant)", 0);
  await tx2.wait();
  console.log("Seller 2 registered:", seller2);

  // Write deploy manifest for post-deploy.sh to consume
  const fs = await import("fs");
  const path = await import("path");
  const manifest = {
    network: isMainnet ? "mainnet" : "testnet",
    chainId: isMainnet ? 1030 : 71,
    verifierAddress,
    tokenAddress: isMainnet ? undefined : tokenAddress,
    tokenAddresses,
    deployer: deployer.address,
    sellers: [
      { address: seller1, escrow: 0, label: "primary" },
      { address: seller2, escrow: 0, label: "instant" },
    ],
    timestamp: new Date().toISOString(),
  };
  const manifestPath = path.resolve(__dirname, "../../../deploy-manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`\nDeploy manifest written to: deploy-manifest.json`);

  // Summary
  console.log("\n═══════════════════════════════════════");
  console.log("          DEPLOYMENT SUMMARY           ");
  console.log("═══════════════════════════════════════");
  console.log("Network:              ", isMainnet ? "Conflux eSpace Mainnet (1030)" : "Conflux eSpace Testnet (71)");
  if (!isMainnet) {
    console.log("MockUSDT0:            ", tokenAddress);
  }
  console.log("X402PaymentVerifier:  ", verifierAddress);
  console.log("Supported tokens:     ", tokenAddresses.join(", "));
  console.log("Deployer:             ", deployer.address);
  console.log("Seller 1:             ", seller1, "(0 escrow)");
  console.log("Seller 2:             ", seller2, "(0 escrow)");
  console.log("\nRun 'bash scripts/post-deploy.sh' to propagate addresses to all .env files and sync ABI.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
