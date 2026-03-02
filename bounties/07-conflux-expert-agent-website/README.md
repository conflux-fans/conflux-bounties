# Conflux Expert Agent Website (Bounty 07)

A production-ready RAG-powered AI assistant that answers Conflux-related questions with cited sources and live on-chain data integration.

## Features

- **RAG Pipeline**: ChromaDB vector store with OpenAI embeddings for Conflux docs
- **Citation-Grounded Responses**: Every answer includes source links and doc titles
- **Live Tool Integration**: ConfluxScan API for real-time gas prices, block info, tx lookup
- **MCP Server Integration**: Reuses Bounty 04 MCP server for on-chain queries
- **Streaming Chat API**: Sub-3s response latency via SSE streaming
- **Public UI**: Next.js frontend with chat interface

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Next.js Frontend                    │
│         (Chat UI + Citation Display)                 │
└──────────────────────┬──────────────────────────────┘
                       │ POST /api/chat (SSE)
┌──────────────────────▼──────────────────────────────┐
│                  RAG API Route                       │
│  1. Embed query (OpenAI ada-002)                     │
│  2. Retrieve top-k chunks (ChromaDB)                 │
│  3. Call live tools if needed (ConfluxScan)          │
│  4. Stream LLM response with citations               │
└──────────────────────────────────────────────────────┘
         │                          │
┌────────▼─────────┐    ┌──────────▼──────────────────┐
│    ChromaDB       │    │   ConfluxScan API            │
│  (Conflux docs,   │    │   + Bounty 04 MCP Server     │
│   chunked+indexed)│    │   (live on-chain data)       │
└───────────────────┘    └─────────────────────────────┘
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set environment variables
cp .env.example .env.local
# Add OPENAI_API_KEY, CONFLUXSCAN_API_KEY

# 3. Ingest Conflux documentation
npm run ingest

# 4. Start development server
npm run dev
```

## Acceptance Criteria

- [x] RAG retrieval returns results with ≥2 cited sources (links + doc titles)
- [x] Citation content verified against source (no hallucination)
- [x] Response latency <3s (streaming)
- [x] ConfluxScan tool returns live CFX gas price
- [x] Deployed UI publicly accessible

## Testing

```bash
npm run test
```

Key test: Query *"How does Conflux's PoW consensus differ from Ethereum?"* must return ≥2 cited sources with relevant content.
