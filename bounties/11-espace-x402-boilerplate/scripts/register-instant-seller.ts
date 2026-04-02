/**
 * Register a new seller wallet with 0 escrow duration (instant release).
 * Used for /data/instant endpoint so payments are released immediately.
 *
 * Steps:
 *   1. Generate a new wallet (INSTANT_SELLER_KEY)
 *   2. Fund it with CFX from the service wallet (for gas + registration fee)
 *   3. Register on-chain with escrowDuration = 0
 *
 * Run: npx tsx scripts/register-instant-seller.ts
 */
import { config } from "dotenv";
config({ path: ".env" });

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const CONTRACT = (process.env.X402_CONTRACT_ADDRESS_TESTNET ||
  process.env.X402_CONTRACT_ADDRESS) as `0x${string}`;
const serviceKey = process.env.SERVICE_WALLET_KEY as `0x${string}`;

// New instant seller wallet — set this in .env after first run
const instantSellerKey = process.env.SERVICE_WALLET_KEY_2 as `0x${string}` | undefined;

if (!serviceKey) {
  console.error("SERVICE_WALLET_KEY not set in .env");
  process.exit(1);
}
if (!instantSellerKey) {
  console.error("SERVICE_WALLET_KEY_2 not set in .env — add it first:");
  console.error("  SERVICE_WALLET_KEY_2=***REDACTED_KEY***");
  process.exit(1);
}
if (!CONTRACT) {
  console.error("X402_CONTRACT_ADDRESS_TESTNET not set in .env");
  process.exit(1);
}

const serviceAccount = privateKeyToAccount(serviceKey);
const instantAccount = privateKeyToAccount(instantSellerKey);

console.log("Service wallet:", serviceAccount.address);
console.log("Instant seller:", instantAccount.address);
console.log("Contract:      ", CONTRACT);

const chain = {
  id: 71,
  name: "Conflux eSpace Testnet",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmtestnet.confluxrpc.com"] } },
};

const publicClient = createPublicClient({ chain, transport: http() });
const serviceWallet = createWalletClient({ account: serviceAccount, chain, transport: http() });
const instantWallet = createWalletClient({ account: instantAccount, chain, transport: http() });

const registerSellerAbi = [
  {
    type: "function" as const,
    name: "registerSeller" as const,
    inputs: [
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
      { name: "escrowDuration", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable" as const,
  },
] as const;

const registrationFeeAbi = [
  {
    type: "function" as const,
    name: "registrationFee" as const,
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
] as const;

const getSellerAbi = [
  {
    type: "function" as const,
    name: "sellers" as const,
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "wallet", type: "address" },
      { name: "apiBaseUrl", type: "string" },
      { name: "description", type: "string" },
      { name: "active", type: "bool" },
      { name: "registeredAt", type: "uint256" },
      { name: "escrowDuration", type: "uint256" },
    ],
    stateMutability: "view" as const,
  },
] as const;

async function main() {
  // 1. Check registration fee
  const fee = await publicClient.readContract({
    address: CONTRACT,
    abi: registrationFeeAbi,
    functionName: "registrationFee",
  });
  console.log(`\nRegistration fee: ${formatEther(fee)} CFX`);

  // 2. Check if already registered
  const existing = await publicClient.readContract({
    address: CONTRACT,
    abi: getSellerAbi,
    functionName: "sellers",
    args: [instantAccount.address],
  });
  if (existing[3]) {
    // active = true
    console.log("\nInstant seller already registered and active!");
    console.log("  Escrow duration:", Number(existing[5]), "seconds");
    console.log("  API URL:", existing[1]);
    return;
  }

  // 3. Check instant seller balance, fund if needed
  const balance = await publicClient.getBalance({ address: instantAccount.address });
  const needed = fee + parseEther("1"); // fee + 1 CFX for gas
  console.log(`Instant seller balance: ${formatEther(balance)} CFX`);

  if (balance < needed) {
    const fundAmount = needed - balance + parseEther("0.5"); // extra buffer
    console.log(`\nFunding instant seller with ${formatEther(fundAmount)} CFX...`);
    const fundHash = await serviceWallet.sendTransaction({
      to: instantAccount.address,
      value: fundAmount,
    });
    console.log("Fund tx:", fundHash);
    await publicClient.waitForTransactionReceipt({ hash: fundHash });
    console.log("Funded!");
  }

  // 4. Register with 0 escrow
  console.log("\nRegistering instant seller with escrowDuration = 0 ...");
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";
  const hash = await instantWallet.writeContract({
    address: CONTRACT,
    abi: registerSellerAbi,
    functionName: "registerSeller",
    args: [apiBase, "Instant-release seller for /data/instant (no escrow)", BigInt(0)],
    value: fee,
  });
  console.log("Register tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);

  // 5. Verify
  const seller = await publicClient.readContract({
    address: CONTRACT,
    abi: getSellerAbi,
    functionName: "sellers",
    args: [instantAccount.address],
  });
  console.log("\nRegistered successfully!");
  console.log("  Wallet:", seller[0]);
  console.log("  API URL:", seller[1]);
  console.log("  Description:", seller[2]);
  console.log("  Active:", seller[3]);
  console.log("  Escrow duration:", Number(seller[5]), "seconds (0 = instant release)");
  console.log("\nAdd these to your .env:");
  console.log(`  SERVICE_WALLET_KEY_2=${instantSellerKey}`);
  console.log(`  SERVICE_WALLET_ADDRESS_2=${instantAccount.address}`);
}

main().catch(console.error);
