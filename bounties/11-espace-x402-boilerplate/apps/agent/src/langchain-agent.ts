/**
 * LangChain-powered x402 AI Agent.
 *
 * Uses an LLM (OpenAI or compatible) to autonomously decide which API
 * endpoints to call, when to pay, and how to interpret results.
 * Falls back to a rule-based agent if no OPENAI_API_KEY is set.
 */
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { X402Agent } from "./agent.js";
import { createX402Tools } from "./tools.js";
import { logger } from "./logger.js";

const SYSTEM_PROMPT = `You are an autonomous AI agent that interacts with x402 payment-gated APIs on Conflux eSpace.

Your capabilities:
- Discover available API endpoints and their pricing
- Call free endpoints without payment
- Call premium endpoints that require USDT0 payment via ERC-3009 (receiveWithAuthorization)
- Manage a spending budget and track transactions
- Payment is gasless — you sign an off-chain authorization, the facilitator submits it on-chain

Payment flow when you hit a 402 paywall:
1. Your tool automatically detects the 402 Payment Required response
2. Signs an EIP-712 ReceiveWithAuthorization (off-chain, no gas cost to you)
3. Submits the signed authorization to the seller API for on-chain settlement
4. Retries the original request with the paid invoice

Always check your budget before making premium calls. Be efficient with spending.
When reporting results, include the endpoint called and any payment made.

You are on Conflux eSpace (testnet, chain ID 71). Payments use USDT0 tokens (6 decimals).`;

export interface LangChainAgentOptions {
  agent: X402Agent;
  openaiApiKey?: string;
  model?: string;
  verbose?: boolean;
}

/**
 * Create and return a LangChain AgentExecutor with x402 tools.
 */
export async function createLangChainAgent(options: LangChainAgentOptions): Promise<AgentExecutor> {
  const { agent, openaiApiKey, model = "gpt-4o-mini", verbose = false } = options;

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is required for LangChain agent mode");
  }

  const llm = new ChatOpenAI({
    modelName: model,
    temperature: 0,
    openAIApiKey: openaiApiKey,
  });

  const tools = createX402Tools(agent);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_PROMPT],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const langchainAgent = await createToolCallingAgent({
    llm,
    tools,
    prompt,
  });

  return new AgentExecutor({
    agent: langchainAgent,
    tools,
    verbose,
    maxIterations: 10,
    returnIntermediateSteps: true,
  });
}

/**
 * Run the LangChain agent with a single prompt and return the result.
 */
export async function runLangChainAgent(
  executor: AgentExecutor,
  input: string,
  chatHistory: (HumanMessage | AIMessage)[] = []
): Promise<{ output: string; steps: unknown[] }> {
  logger.info({ input }, "LangChain agent processing...");

  const result = await executor.invoke({
    input,
    chat_history: chatHistory,
  });

  logger.info({ output: result.output?.substring(0, 200) }, "LangChain agent responded");

  return {
    output: result.output,
    steps: result.intermediateSteps || [],
  };
}
