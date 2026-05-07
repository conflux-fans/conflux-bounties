/**
 * LangChain tools for the x402 AI Agent.
 *
 * Each tool wraps an API call that may encounter a 402 paywall.
 * The agent autonomously detects 402, signs an ERC-3009 authorization,
 * submits it for settlement, and retries — all within the tool execution.
 */
import { DynamicTool, DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { X402Agent } from "./agent.js";
import { logger } from "./logger.js";
import { TOKEN_DECIMALS } from "@x402/shared";

/**
 * Create the full set of LangChain tools for x402 API interaction.
 */
export function createX402Tools(agent: X402Agent) {
  const healthCheckTool = new DynamicTool({
    name: "health_check",
    description:
      "Check the health status of the x402 API server. Returns server status, uptime, payment method, and wallet address. This is a free endpoint — no payment required.",
    func: async () => {
      try {
        const result = await agent.callEndpoint("/health");
        return JSON.stringify(result, null, 2);
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const freeDataTool = new DynamicTool({
    name: "get_free_data",
    description:
      "Fetch free data from the API. Returns sample data that is available without payment. Use this to test connectivity before calling premium endpoints.",
    func: async () => {
      try {
        const result = await agent.callEndpoint("/data/free");
        return JSON.stringify(result, null, 2);
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const premiumDataTool = new DynamicTool({
    name: "get_premium_data",
    description:
      "Fetch premium data from the API. Costs 0.10 USDT0 per request. If a 402 Payment Required response is received, the tool will automatically sign an ERC-3009 receiveWithAuthorization, submit it for on-chain settlement, and retry the request. The payment is gasless for the caller.",
    func: async () => {
      try {
        const result = await agent.callEndpoint("/data/premium");
        return JSON.stringify(result, null, 2);
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const computeSimulateTool = new DynamicStructuredTool({
    name: "run_compute_simulation",
    description:
      "Run a compute simulation on the premium API. Costs 0.50 USDT0 per request. Accepts an 'iterations' parameter (number of simulation iterations). If a 402 Payment Required response is received, the tool will automatically handle payment via ERC-3009 authorization.",
    schema: z.object({
      iterations: z
        .number()
        .min(1)
        .max(10000)
        .default(100)
        .describe("Number of simulation iterations to run (1-10000)"),
    }),
    func: async ({ iterations }) => {
      try {
        const result = await agent.callEndpoint("/compute/simulate", "POST", {
          iterations,
        });
        return JSON.stringify(result, null, 2);
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const listEndpointsTool = new DynamicTool({
    name: "list_endpoints",
    description:
      "List all available API endpoints with their pricing. Shows which endpoints are free and which require USDT0 payment via x402. Useful for discovering what the API offers.",
    func: async () => {
      try {
        const result = await agent.callEndpoint("/admin/pricing");
        return JSON.stringify(result, null, 2);
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const getAnalyticsTool = new DynamicTool({
    name: "get_analytics",
    description:
      "Get API usage analytics including total requests, revenue, and per-endpoint statistics. This is a free admin endpoint.",
    func: async () => {
      try {
        const result = await agent.callEndpoint("/admin/analytics");
        return JSON.stringify(result, null, 2);
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const checkBudgetTool = new DynamicTool({
    name: "check_budget",
    description:
      "Check the agent's current spending budget. Returns total spent, daily spent, remaining cap, and transaction count. Use this before making premium calls to verify you have sufficient budget.",
    func: async () => {
      try {
        const summary = agent.getSpendSummary();
        return JSON.stringify(
          {
            totalSpent: `${(Number(summary.totalSpent) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
            dailySpent: `${(Number(summary.dailySpent) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
            remainingCap: `${(Number(summary.remainingCap) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
            remainingDaily: `${(Number(summary.remainingDaily) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
            transactions: summary.txCount,
          },
          null,
          2
        );
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  return [
    healthCheckTool,
    freeDataTool,
    premiumDataTool,
    computeSimulateTool,
    listEndpointsTool,
    getAnalyticsTool,
    checkBudgetTool,
  ];
}
