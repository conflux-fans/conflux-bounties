# Bounty #07: Conflux Expert Agent Website (RAG + Tools)

## Overview
- **Reward**: $1,200
- **Difficulty**: 🟡 Medium
- **Timeline**: 3–4 weeks
- **Type**: AI Agent, RAG, Full-Stack Web
- **Status**: 🧪 Experimental / Non-Production
- **Goal**: Build an MVP public-facing AI assistant that answers Conflux questions using retrieval-augmented generation with citation-backed responses. Focus on core RAG functionality with basic tool integration (MCP or ConfluxScan).
- **Note**: This bounty is exploratory in nature. It is not expected to yield a production-ready system; rather, it aims to stimulate community creativity and surface architectural ideas or design patterns.
- **Change Requests**: Suggestions are welcome during the claim discussion; finalize scope before assignment.

## Problem Statement
Developers lack a single destination for authoritative Conflux knowledge that stays current with docs, repos, and network data. Existing chatbots hallucinate because they cannot cross-check on-chain state or cite sources. A curated RAG system with tool execution bridges this gap.

## Solution Overview
Build a Next.js site that hosts an "Expert Agent" chat interface. The backend orchestrates embeddings and vector search over curated Conflux resources (docs, blog posts, GitHub repos). During each question, the agent retrieves top passages, optionally calls one live tool (MCP server or ConfluxScan), and returns citations. Provide a simple admin workflow to sync content from GitHub.

## Core Features
1. **Content Pipeline**: CLI script that syncs Markdown/docs via GitHub API; produces cleaned markdown + metadata; updates vector store.
2. **RAG Service**: Embedding generation (OpenAI or equivalent), chunking, metadata tagging (source, URL), similarity search.
3. **Agent Orchestration**: LangChain or OpenAI Assistants with one tool integration (MCP server OR ConfluxScan API) for live data queries.
4. **Chat UI**: Streaming responses with message history, citation chips, copy buttons, basic dark mode.
5. **Admin Panel**: Simple resource ingestion status and manual sync trigger.

## Technical Requirements
### Architecture
- Frontend: Next.js (app router) + Tailwind; deployable to Vercel or similar.
- Backend: Serverless functions for chat API; simple background job for ingestion.
- Vector Store: Pinecone, Supabase Vector, or Weaviate (must document choice).
- Tools: Choose ONE - either MCP server wrapper OR ConfluxScan REST client (not both required).
- Observability: Basic logging and error handling.

### Data & Retrieval
- Curate at least 5 Conflux sources (docs, repos) with metadata: title, description, permalink.
- Basic similarity search without complex filtering.

### Agent Behaviors
- Must cite every answer with `[1]` style references linking to original source.
- Optionally call tool when live data is needed (if tool integration is implemented).
- Support basic conversation memory for follow-up questions.

## Deliverables
1. **RAG System**: Ingestion scripts, vector DB setup, basic job automation, docs on adding new sources.
2. **Agent + Tools**: Orchestrator code, ONE tool adapter (MCP OR ConfluxScan), GitHub sync.
3. **Web App**: Chat UI, landing page, simple admin panel (basic auth acceptable).
4. **Docs**: README, architecture diagram, env sample, deployment guide.
5. **Tests**: Unit tests for ingestion + tool wrapper, basic regression suite for 10 benchmark questions.

## Acceptance Criteria
- ✅ Answers cite at least one source per response, linking to original URL.
- ✅ Agent can call at least one live tool (MCP OR ConfluxScan) and display results inline.
- ✅ Admin can trigger content resync manually.
- ✅ Vector store holds ≥2k chunks with basic search functioning.
- ✅ Application deploys and runs locally with clear setup instructions.

## Example User Flow
1. User visits site, reads featured topics, and opens chat.
2. User asks “How do I deploy a Conflux eSpace smart contract?”.
3. Backend retrieves relevant docs, calls MCP for latest gas price, and streams response with citations `[1][2]`.
4. User requests transcript; app generates Markdown download.
5. Admin logs in, triggers repo sync, and monitors embedding progress.

## Environment & Config
- `CONFLUXSCAN_API_KEY`, `CONFLUX_RPC_URL`
- `OPENAI_API_KEY` or equivalent LLM keys
- `VECTOR_DB_URL`, `VECTOR_DB_KEY`
- `GITHUB_TOKEN`, `SYNC_SOURCES_JSON`
- `MCP_SERVER_URL`, `NEXT_PUBLIC_SITE_NAME`

## Evaluation Criteria
- **Conceptual Soundness & Learning Value (40%)**: Quality of the architectural design, novelty of the approach, and insights gained for future work.
- **System Reliability & RAG Quality (30%)**: Accuracy of answers, citation coverage, and basic tool integration performance.
- **UX & Documentation (30%)**: Clarity of the UI, quality of the documentation, and ease of running the experiment.

