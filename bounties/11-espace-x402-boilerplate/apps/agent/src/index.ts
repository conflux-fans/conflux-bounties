#!/usr/bin/env node
/**
 * x402 AI Agent — CLI Entry Point
 *
 * Modes:
 *   demo       Run the full demo flow (discovery → payment → data retrieval)
 *   langchain  Start an interactive LangChain agent session (requires OPENAI_API_KEY)
 *   direct     Run a single endpoint call (e.g., npx tsx src/index.ts direct /data/premium)
 *
 * Usage:
 *   npx tsx src/index.ts demo
 *   npx tsx src/index.ts langchain
 *   npx tsx src/index.ts direct /data/premium
 *   npx tsx src/index.ts direct /compute/simulate POST '{"iterations":500}'
 */
import { X402Agent } from "./agent.js";
import { logger } from "./logger.js";
import { agentConfig } from "./config.js";
import { createX402Tools } from "./tools.js";
import { TOKEN_DECIMALS } from "@x402/shared";

// ─── CLI Argument Parsing ───

const args = process.argv.slice(2);
const mode = args[0] || "demo";

async function main() {
  logger.info("╔════════════════════════════════════════════════╗");
  logger.info("║   x402 AI Agent — Conflux eSpace (USDT0)      ║");
  logger.info("╚════════════════════════════════════════════════╝");
  logger.info({
    mode,
    apiBase: agentConfig.apiBase,
    spendCap: `${(Number(agentConfig.spendCap) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
    dailyBudget: `${(Number(agentConfig.dailyBudget) / 10 ** TOKEN_DECIMALS).toFixed(2)} USDT0`,
  });

  if (!agentConfig.privateKey) {
    logger.error("AGENT_PRIVATE_KEY not set. Set it in .env or environment.");
    logger.info("Example: AGENT_PRIVATE_KEY=0xabc123... npx tsx src/index.ts demo");
    process.exit(1);
  }

  const agent = new X402Agent(agentConfig);

  try {
    switch (mode) {
      case "demo":
        await runDemo(agent);
        break;
      case "langchain":
        await runLangChain(agent);
        break;
      case "direct":
        await runDirect(agent, args.slice(1));
        break;
      default:
        logger.error({ mode }, "Unknown mode. Use: demo | langchain | direct");
        process.exit(1);
    }
  } finally {
    agent.printSessionSummary();
    agent.close();
  }
}

// ─── Demo Mode ───
// Full scripted flow: health → free → premium (402 → pay → retry) → compute

async function runDemo(agent: X402Agent) {
  const startTime = Date.now();

  logger.info("\n━━━ STEP 1/5: Discover API endpoints ━━━");
  try {
    const pricing = await agent.callEndpoint("/admin/pricing");
    logger.info({ pricing }, "Available endpoints and pricing");
  } catch (err) {
    logger.warn("Could not fetch pricing (non-critical)");
  }

  logger.info("\n━━━ STEP 2/5: Health check ━━━");
  const health = await agent.callEndpoint("/health");
  logger.info({ health }, "Server health");

  logger.info("\n━━━ STEP 3/5: Free data (no payment) ━━━");
  const freeData = await agent.callEndpoint("/data/free");
  logger.info({ freeData }, "Free data retrieved");

  logger.info("\n━━━ STEP 4/5: Premium data (will trigger 402 → ERC-3009 sign → settle → retry) ━━━");
  try {
    const premiumData = await agent.callEndpoint("/data/premium");
    logger.info({ premiumData }, "Premium data retrieved after payment");
  } catch (err) {
    logger.error({ err }, "Premium data call failed");
  }

  logger.info(
    "\n━━━ STEP 5/5: Compute simulation (will trigger 402 → ERC-3009 sign → settle → retry) ━━━"
  );
  try {
    const computeResult = await agent.callEndpoint("/compute/simulate", "POST", {
      iterations: 500,
    });
    logger.info({ computeResult }, "Compute simulation completed after payment");
  } catch (err) {
    logger.error({ err }, "Compute simulation failed");
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info("\n━━━ DEMO COMPLETE ━━━");
  logger.info({ elapsedSeconds: elapsed }, "Full discovery → payment → data flow completed");
}

// ─── LangChain Mode ───
// Interactive agent session with LLM-driven tool selection

async function runLangChain(agent: X402Agent) {
  if (!agentConfig.openaiApiKey) {
    logger.warn("OPENAI_API_KEY not set — falling back to tool-based demo");
    logger.info("Set OPENAI_API_KEY to use the full LangChain interactive agent.\n");
    await runToolDemo(agent);
    return;
  }

  const { createLangChainAgent, runLangChainAgent } = await import("./langchain-agent.js");
  const { HumanMessage, AIMessage } = await import("@langchain/core/messages");

  const executor = await createLangChainAgent({
    agent,
    openaiApiKey: agentConfig.openaiApiKey,
    verbose: true,
  });

  const chatHistory: (InstanceType<typeof HumanMessage> | InstanceType<typeof AIMessage>)[] = [];

  // Run a predefined conversation to demonstrate the agent
  const prompts = [
    "What API endpoints are available and how much do they cost?",
    "Check my current budget, then fetch the premium data endpoint.",
    "Now run a compute simulation with 250 iterations.",
    "Give me a summary of what we did and how much we spent.",
  ];

  logger.info("\n━━━ LangChain Agent Session ━━━");
  logger.info("Running autonomous conversation with LLM...\n");

  for (const prompt of prompts) {
    logger.info(`\n👤 User: ${prompt}`);
    const result = await runLangChainAgent(executor, prompt, chatHistory);
    logger.info(`\n🤖 Agent: ${result.output}`);

    chatHistory.push(new HumanMessage(prompt));
    chatHistory.push(new AIMessage(result.output));
  }
}

// ─── Tool Demo Mode (fallback when no LLM key) ───
// Demonstrates all LangChain tools sequentially without an LLM

async function runToolDemo(agent: X402Agent) {
  const tools = createX402Tools(agent);
  const startTime = Date.now();

  logger.info("━━━ Tool-based Demo (no LLM) ━━━");
  logger.info(`Available tools: ${tools.map((t) => t.name).join(", ")}\n`);

  for (const tool of tools) {
    logger.info(`\n▶ Running tool: ${tool.name}`);
    logger.info(`  Description: ${tool.description.substring(0, 100)}...`);
    try {
      let result: string;
      if (tool.name === "run_compute_simulation") {
        result = await (tool as any).invoke({ iterations: 200 });
      } else {
        result = await (tool as any).invoke("");
      }
      // Truncate long output for readability
      const truncated = result.length > 500 ? result.substring(0, 500) + "..." : result;
      logger.info(`  Result: ${truncated}`);
    } catch (err) {
      logger.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`\n━━━ Tool demo complete in ${elapsed}s ━━━`);
}

// ─── Direct Mode ───
// Call a single endpoint from the CLI

async function runDirect(agent: X402Agent, directArgs: string[]) {
  const path = directArgs[0];
  const method = directArgs[1] || "GET";
  const bodyStr = directArgs[2];

  if (!path) {
    logger.error("Usage: npx tsx src/index.ts direct <path> [method] [json-body]");
    logger.info("Examples:");
    logger.info("  npx tsx src/index.ts direct /health");
    logger.info("  npx tsx src/index.ts direct /data/premium");
    logger.info('  npx tsx src/index.ts direct /compute/simulate POST \'{"iterations":500}\'');
    process.exit(1);
  }

  let body: unknown;
  if (bodyStr) {
    try {
      body = JSON.parse(bodyStr);
    } catch {
      logger.error("Invalid JSON body");
      process.exit(1);
    }
  }

  logger.info({ path, method, body }, "Direct endpoint call");
  const result = await agent.callEndpoint(path, method, body);
  console.log(JSON.stringify(result, null, 2));
}

// ─── Run ───

main().catch((err) => {
  logger.error(err, "Agent crashed");
  process.exit(1);
});
