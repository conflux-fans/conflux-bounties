#!/usr/bin/env node
/**
 * x402 MCP Server — bridges the X402Agent to nanobot (or any MCP client).
 *
 * Exposes 7 tools over stdio that let a conversational AI agent interact
 * with x402 payment-gated APIs on Conflux eSpace. No bash, no file access,
 * no secret leaking — only the 7 API tools + budget check.
 *
 * Usage:
 *   npx tsx apps/agent/src/mcp-server.ts            # standalone
 *   (or spawned by nanobot as an MCP child process)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { X402Agent } from "./agent.js";
import { agentConfig } from "./config.js";
import { TOKEN_DECIMALS } from "@x402/shared";

// ─── Sanitize: strip any sensitive-looking fields from API responses ───

const SENSITIVE_KEYS = /private.?key|secret|api.?key|password|mnemonic|seed/i;

function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.test(k)) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = sanitize(v);
      }
    }
    return result;
  }
  return obj;
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(sanitize(data), null, 2) }] };
}

function errorResult(msg: string) {
  return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
}

// ─── Agent init ───

if (!agentConfig.privateKey) {
  process.stderr.write("AGENT_PRIVATE_KEY not set — MCP server cannot sign payments.\n");
  process.exit(1);
}

const agent = new X402Agent(agentConfig);

// ─── MCP Server ───

const server = new McpServer({
  name: "x402-agent",
  version: "0.1.0",
});

// Tool 1: Health check
server.tool(
  "health_check",
  "Check the health status of the x402 API server. Returns server status, uptime, payment method, and wallet address. Free endpoint — no payment required.",
  {},
  async () => {
    try {
      const result = await agent.callEndpoint("/health");
      return textResult(result);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }
);

// Tool 2: Free data
server.tool(
  "get_free_data",
  "Fetch free sample data from the API. Returns blockchain metrics available without payment. Use to test connectivity before calling premium endpoints.",
  {},
  async () => {
    try {
      const result = await agent.callEndpoint("/data/free");
      return textResult(result);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }
);

// Tool 3: Premium data (0.10 USDT0)
server.tool(
  "get_premium_data",
  "Fetch premium analytics data. Costs 0.10 USDT0 per request. If a 402 Payment Required response is received, the tool automatically signs an ERC-3009 receiveWithAuthorization, submits it for on-chain settlement, and retries. Payment is gasless for the caller.",
  {},
  async () => {
    try {
      const result = await agent.callEndpoint("/data/premium");
      return textResult(result);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }
);

// Tool 4: Compute simulation (0.50 USDT0)
server.tool(
  "run_compute_simulation",
  "Run a compute simulation on the premium API. Costs 0.50 USDT0 per request. Accepts iterations parameter (1-10000). Handles 402 payment automatically via ERC-3009.",
  { iterations: z.number().min(1).max(10000).default(100).describe("Number of simulation iterations (1-10000)") },
  async ({ iterations }) => {
    try {
      const result = await agent.callEndpoint("/compute/simulate", "POST", { iterations });
      return textResult(result);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }
);

// Tool 5: List endpoints
server.tool(
  "list_endpoints",
  "List all available API endpoints with their pricing. Shows which endpoints are free and which require USDT0 payment via x402.",
  {},
  async () => {
    try {
      const result = await agent.callEndpoint("/admin/pricing");
      return textResult(result);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }
);

// Tool 6: Analytics
server.tool(
  "get_analytics",
  "Get API usage analytics including total requests, revenue, and per-endpoint statistics.",
  {},
  async () => {
    try {
      const result = await agent.callEndpoint("/admin/analytics");
      return textResult(result);
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }
);

// Tool 7: Budget check
server.tool(
  "check_budget",
  "Check the agent's current spending budget. Returns total spent, daily spent, remaining cap, and transaction count. Always check this before making premium calls.",
  {},
  async () => {
    try {
      const summary = agent.getSpendSummary();
      return textResult({
        totalSpent: `${(Number(summary.totalSpent) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
        dailySpent: `${(Number(summary.dailySpent) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
        remainingCap: `${(Number(summary.remainingCap) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
        remainingDaily: `${(Number(summary.remainingDaily) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
        transactions: summary.txCount,
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }
);

// ─── Start ───

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`x402 MCP server running (agent: ${agent.address})\n`);
}

main().catch((err) => {
  process.stderr.write(`MCP server failed: ${err}\n`);
  process.exit(1);
});
