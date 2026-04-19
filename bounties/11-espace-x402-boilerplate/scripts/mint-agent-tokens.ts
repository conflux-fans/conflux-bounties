/**
 * Mint USDT0 test tokens to the agent wallet.
 * Run: npx tsx scripts/mint-agent-tokens.ts
 */
import { config } from "dotenv";
config({ path: ".env" });
import { createWalletClient, createPublicClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const USDT0 = process.env.USDT0_ADDRESS_TESTNET;
if (!USDT0) throw new Error("USDT0_ADDRESS_TESTNET not set in .env");
const serviceKey = process.env.SERVICE_WALLET_KEY as `0x${string}`;
const agentKey = process.env.AGENT_PRIVATE_KEY as `0x${string}`;

const agentAccount = privateKeyToAccount(agentKey);
const serviceAccount = privateKeyToAccount(serviceKey);

console.log("Service wallet:", serviceAccount.address);
console.log("Agent wallet:  ", agentAccount.address);
console.log("USDT0 contract:", USDT0);

const chain = {
  id: 71,
  name: "Conflux eSpace Testnet",
  nativeCurrency: { name: "CFX", symbol: "CFX", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmtestnet.confluxrpc.com"] } },
};

const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ account: serviceAccount, chain, transport: http() });

const mintAbi = [
  {
    type: "function" as const,
    name: "mint" as const,
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable" as const,
  },
] as const;

const balAbi = [
  {
    type: "function" as const,
    name: "balanceOf" as const,
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view" as const,
  },
] as const;

async function main() {
  const amount = parseUnits("100", 6); // 100 USDT0
  console.log("\nMinting 100 USDT0 to agent wallet...");

  const hash = await walletClient.writeContract({
    address: USDT0 as `0x${string}`,
    abi: mintAbi,
    functionName: "mint",
    args: [agentAccount.address, amount],
  });
  console.log("Tx hash:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);

  const bal = await publicClient.readContract({
    address: USDT0 as `0x${string}`,
    abi: balAbi,
    functionName: "balanceOf",
    args: [agentAccount.address],
  });
  console.log("Agent USDT0 balance:", Number(bal) / 1e6, "USDT0");
}

main().catch(console.error);
