// Agent configuration — loaded from environment variables
// All budget values in USDT0 smallest unit (6 decimals): 1 USDT0 = 1_000_000
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from monorepo root (3 levels up from apps/agent/src/)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../../.env") });

export const agentConfig = {
  apiBase: process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000",
  privateKey: (process.env.AGENT_PRIVATE_KEY || "") as `0x${string}`,
  contractAddress: (process.env.X402_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  rpcUrl: process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com",
  // USDT0 has 6 decimals: 10_000_000 = 10 USDT0
  spendCap: process.env.AGENT_SPEND_CAP || "10000000",       // 10 USDT0
  dailyBudget: process.env.AGENT_DAILY_BUDGET || "5000000",   // 5 USDT0
  pollIntervalMs: Number(process.env.AGENT_POLL_INTERVAL_MS) || 5000,
  maxRetries: 3,
  // OpenAI key for LangChain (optional — agent works without it in direct mode)
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  // SQLite database path for session persistence
  dbPath: process.env.AGENT_DB_PATH || "./agent-sessions.db",
} as const;
