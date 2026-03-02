/**
 * RAG Pipeline for Conflux Expert Agent
 *
 * WHY THIS FILE EXISTS:
 * Core retrieval-augmented generation logic that:
 * 1. Embeds user queries using OpenAI ada-002
 * 2. Retrieves top-k semantically similar chunks from ChromaDB
 * 3. Integrates live ConfluxScan data when query involves on-chain info
 * 4. Streams LLM responses with grounded citations
 *
 * Design decisions:
 * - ChromaDB chosen over Pinecone for zero-cost local dev + easy Docker deploy
 * - Chunk size 512 tokens with 64-token overlap balances context vs. precision
 * - Citations returned as structured metadata, not inline text, so UI can render them
 */

import OpenAI from "openai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;      // URL or file path
    title: string;       // Human-readable doc title
    section?: string;    // Sub-heading if available
    chunkIndex: number;
  };
  score?: number;        // Cosine similarity score from retrieval
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RAGResponse {
  answer: string;
  citations: Citation[];
  toolResults?: ToolResult[];
  latencyMs: number;
}

export interface Citation {
  title: string;
  source: string;
  excerpt: string;       // Relevant excerpt that supports the answer
  score: number;
}

export interface ToolResult {
  tool: string;
  query: string;
  result: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// ConfluxScan Live Tool
// WHY: Bounty requires ≥2 live tools; ConfluxScan is the primary Conflux
// block explorer with a free public API for gas, blocks, txs, tokens.
// ---------------------------------------------------------------------------

const CONFLUXSCAN_BASE = "https://api.confluxscan.io";
const CONFLUXSCAN_ESPACE_BASE = "https://evmapi.confluxscan.io";

export async function getGasPrice(): Promise<ToolResult> {
  // WHY: Gas price is the most common "live data" query; proves tool integration works
  const res = await fetch(`${CONFLUXSCAN_ESPACE_BASE}/api?module=proxy&action=eth_gasPrice`);
  if (!res.ok) throw new Error(`ConfluxScan gas price fetch failed: ${res.status}`);
  const data = await res.json() as { result: string };
  const gasPriceGwei = parseInt(data.result, 16) / 1e9;
  return {
    tool: "confluxscan_gas_price",
    query: "current CFX gas price",
    result: { gasPriceGwei, gasPriceHex: data.result, network: "eSpace" },
  };
}

export async function getLatestBlock(): Promise<ToolResult> {
  const res = await fetch(`${CONFLUXSCAN_ESPACE_BASE}/api?module=proxy&action=eth_blockNumber`);
  if (!res.ok) throw new Error(`ConfluxScan block number fetch failed: ${res.status}`);
  const data = await res.json() as { result: string };
  return {
    tool: "confluxscan_latest_block",
    query: "latest block number",
    result: { blockNumber: parseInt(data.result, 16), blockNumberHex: data.result, network: "eSpace" },
  };
}

export async function lookupTransaction(txHash: string): Promise<ToolResult> {
  const res = await fetch(
    `${CONFLUXSCAN_BASE}/api/v1/transaction?hash=${txHash}`
  );
  if (!res.ok) throw new Error(`ConfluxScan tx lookup failed: ${res.status}`);
  const data = await res.json();
  return {
    tool: "confluxscan_tx_lookup",
    query: `transaction ${txHash}`,
    result: data,
  };
}

// ---------------------------------------------------------------------------
// Tool routing: decide which live tools to call based on query content
// WHY: Avoids calling all tools on every query (latency + rate limits).
// Simple keyword matching is fast and sufficient for MVP scope.
// ---------------------------------------------------------------------------

export async function routeAndCallTools(query: string): Promise<ToolResult[]> {
  const q = query.toLowerCase();
  const results: ToolResult[] = [];

  // Gas price queries
  if (/gas\s*price|gas\s*fee|transaction\s*cost|gwei/i.test(q)) {
    results.push(await getGasPrice());
  }

  // Block / chain status queries
  if (/latest\s*block|block\s*number|current\s*block|chain\s*tip/i.test(q)) {
    results.push(await getLatestBlock());
  }

  // Transaction lookup — extract 0x hash if present
  const txMatch = q.match(/0x[a-f0-9]{64}/i);
  if (txMatch) {
    results.push(await lookupTransaction(txMatch[0]));
  }

  // Always include gas price if no other tool fired (demonstrates live integration)
  if (results.length === 0 && /conflux|cfx|network|blockchain/i.test(q)) {
    results.push(await getGasPrice());
  }

  return results;
}

// ---------------------------------------------------------------------------
// ChromaDB client (HTTP API)
// WHY: Using ChromaDB HTTP client instead of the JS SDK to avoid
// native dependency issues in Next.js edge runtime. The REST API is stable.
// ---------------------------------------------------------------------------

const CHROMA_URL = process.env.CHROMA_URL ?? "http://localhost:8000";
const COLLECTION_NAME = "conflux_docs";

async function queryChroma(
  embedding: number[],
  nResults: number = 5
): Promise<DocumentChunk[]> {
  const res = await fetch(
    `${CHROMA_URL}/api/v1/collections/${COLLECTION_NAME}/query`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query_embeddings: [embedding],
        n_results: nResults,
        include: ["documents", "metadatas", "distances"],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`ChromaDB query failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as {
    documents: string[][];
    metadatas: Record<string, unknown>[][];
    distances: number[][];
    ids: string[][];
  };

  // WHY: Transform ChromaDB response format into our clean DocumentChunk type
  return data.documents[0].map((doc, i) => ({
    id: data.ids[0][i],
    content: doc,
    metadata: data.metadatas[0][i] as DocumentChunk["metadata"],
    // Convert distance to similarity score (ChromaDB returns L2 or cosine distance)
    score: 1 - (data.distances[0][i] ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Main RAG function
// WHY: Single entry point keeps the API route clean. All RAG logic is here.
// ---------------------------------------------------------------------------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function ragQuery(
  query: string,
  history: ChatMessage[] = [],
  options: { nResults?: number; minScore?: number } = {}
): Promise<RAGResponse> {
  const startMs = Date.now();
  const { nResults = 5, minScore = 0.3 } = options;

  // Step 1: Embed the user query
  // WHY: Must embed query with the SAME model used during ingestion (ada-002)
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: query,
  });
  const queryEmbedding = embeddingRes.data[0].embedding;

  // Step 2: Retrieve relevant chunks from ChromaDB
  const chunks = await queryChroma(queryEmbedding, nResults);

  // Filter by minimum similarity score to avoid hallucination from irrelevant context
  const relevantChunks = chunks.filter((c) => (c.score ?? 0) >= minScore);

  // Step 3: Call live tools in parallel with LLM call for lower latency
  const toolResultsPromise = routeAndCallTools(query);

  // Step 4: Build citations from retrieved chunks
  // WHY: Citations are built BEFORE the LLM call so they're grounded in
  // retrieved content, not generated text. This prevents hallucinated citations.
  const citations: Citation[] = relevantChunks.map((chunk) => ({
    title: chunk.metadata.title,
    source: chunk.metadata.source,
    excerpt: chunk.content.slice(0, 300) + (chunk.content.length > 300 ? "..." : ""),
    score: chunk.score ?? 0,
  }));

  // Step 5: Build the system prompt with retrieved context
  const contextText = relevantChunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}: ${chunk.metadata.title}]\n${chunk.content}`
    )
    .join("\n\n---\n\n");

  const toolResults = await toolResultsPromise;
  const toolContext =
    toolResults.length > 0
      ? `\n\n## Live On-Chain Data\n` +
        toolResults
          .map((t) => `**${t.tool}**: ${JSON.stringify(t.result)}`)
          .join("\n")
      : "";

  const systemPrompt = `You are ConfluxPedia, an expert AI assistant for the Conflux blockchain ecosystem.
Your answers are always grounded in the provided documentation sources.
When answering, reference the source numbers (e.g., [Source 1]) to ground your claims.
If the sources don't contain enough information, say so clearly rather than guessing.
Be concise, technical, and accurate.

## Retrieved Documentation\n${contextText}${toolContext}`;

  // Step 6: Stream LLM response
  // WHY: Streaming reduces perceived latency — user sees first tokens in <1s
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    // Include last 4 history messages for context (avoid token bloat)
    ...history.slice(-4).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: query },
  ];

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",  // WHY: Cheaper than gpt-4o, still excellent for RAG tasks
    messages,
    stream: true,
    temperature: 0.2,     // WHY: Low temperature for factual accuracy
    max_tokens: 1024,
  });

  let answer = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content ?? "";
    answer += delta;
  }

  return {
    answer,
    citations,
    toolResults: toolResults.length > 0 ? toolResults : undefined,
    latencyMs: Date.now() - startMs,
  };
}

// ---------------------------------------------------------------------------
// Streaming variant for SSE API routes
// WHY: Next.js App Router supports ReadableStream responses natively.
// We use this to stream tokens to the browser for <3s perceived latency.
// ---------------------------------------------------------------------------

export async function ragQueryStream(
  query: string,
  history: ChatMessage[] = [],
  options: { nResults?: number; minScore?: number } = {}
): Promise<ReadableStream<Uint8Array>> {
  const { nResults = 5, minScore = 0.3 } = options;

  // Embed + retrieve (cannot stream these — must await before LLM call)
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: query,
  });
  const queryEmbedding = embeddingRes.data[0].embedding;
  const chunks = await queryChroma(queryEmbedding, nResults);
  const relevantChunks = chunks.filter((c) => (c.score ?? 0) >= minScore);

  // Call tools in parallel
  const toolResults = await routeAndCallTools(query);

  const citations: Citation[] = relevantChunks.map((chunk) => ({
    title: chunk.metadata.title,
    source: chunk.metadata.source,
    excerpt: chunk.content.slice(0, 300) + (chunk.content.length > 300 ? "..." : ""),
    score: chunk.score ?? 0,
  }));

  const contextText = relevantChunks
    .map((chunk, i) => `[Source ${i + 1}: ${chunk.metadata.title}]\n${chunk.content}`)
    .join("\n\n---\n\n");

  const toolContext =
    toolResults.length > 0
      ? `\n\n## Live On-Chain Data\n` +
        toolResults.map((t) => `**${t.tool}**: ${JSON.stringify(t.result)}`).join("\n")
      : "";

  const systemPrompt = `You are ConfluxPedia, an expert AI assistant for the Conflux blockchain ecosystem.
Your answers are always grounded in the provided documentation sources.
Reference source numbers (e.g., [Source 1]) in your answer to ground your claims.
If sources lack information, say so clearly. Be concise, technical, and accurate.

## Retrieved Documentation\n${contextText}${toolContext}`;

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-4).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: query },
  ];

  const encoder = new TextEncoder();

  // Return a ReadableStream that sends SSE events
  return new ReadableStream({
    async start(controller) {
      // First, send citations and tool results as metadata event
      // WHY: Frontend needs citations before/during streaming to display them
      const metaEvent = `data: ${JSON.stringify({
        type: "meta",
        citations,
        toolResults: toolResults.length > 0 ? toolResults : undefined,
      })}\n\n`;
      controller.enqueue(encoder.encode(metaEvent));

      // Stream LLM tokens
      const stream = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        stream: true,
        temperature: 0.2,
        max_tokens: 1024,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          const tokenEvent = `data: ${JSON.stringify({ type: "token", delta })}\n\n`;
          controller.enqueue(encoder.encode(tokenEvent));
        }
      }

      // Send done event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    },
  });
}
