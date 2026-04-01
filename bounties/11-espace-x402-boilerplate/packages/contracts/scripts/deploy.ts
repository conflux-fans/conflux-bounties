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

  const serviceWallet = process.env.SERVICE_WALLET_ADDRESS || deployer.address;

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

  // Register the deployer as the first seller
  console.log("\n--- Registering deployer as seller ---");
  const apiBaseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const tx = await verifier.registerSeller(apiBaseUrl, "x402 Seller API boilerplate");
  await tx.wait();
  console.log("Seller registered:", serviceWallet, "->", apiBaseUrl);

  // Summary
  console.log("\n--- Deployment Summary ---");
  console.log("Network:              ", isMainnet ? "Conflux eSpace Mainnet (1030)" : "Conflux eSpace Testnet (71)");
  if (!isMainnet) {
    console.log("MockUSDT0:            ", tokenAddress);
  }
  console.log("X402PaymentVerifier:  ", verifierAddress);
  console.log("Supported tokens:     ", tokenAddresses.join(", "));
  console.log("Deployer/Seller:      ", deployer.address);
  console.log("Service wallet:       ", serviceWallet);
  console.log("\nAdd to your .env:");
  if (!isMainnet) {
    console.log(`USDT0_ADDRESS=${tokenAddress}`);
  }
  console.log(`X402_CONTRACT_ADDRESS=${verifierAddress}`);
  if (isMainnet) {
    console.log(`NETWORK=mainnet`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
