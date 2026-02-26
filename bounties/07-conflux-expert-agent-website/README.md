# Conflux Expert

> **AI-powered blockchain assistant** for Conflux Network with RAG-powered search, live on-chain data, and cited sources.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

Get accurate, cited answers about Conflux blockchain.

---

## Project Structure

```
conflux-expert/
├── app/                    # Next.js app router
│   ├── page.tsx           # Landing page
│   ├── chat/              # Chat interface
│   ├── admin/             # Admin panel
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── chat/             # Chat UI components
│   └── landing/          # Landing page sections
├── lib/                   # Frontend utilities
├── backend/              # Python services
│   ├── app/
│   │   ├── rag/          # RAG service
│   │   ├── tools/        # ConfluxScan wrapper
│   │   ├── agent/        # LangChain orchestrator
│   │   └── ingestion/    # Content pipeline
│   └── scripts/          # CLI tools
└── docs/                 # Documentation
```
