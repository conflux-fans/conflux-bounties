# Confluxpedia Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CONFLUXPEDIA                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Next.js    │    │   Gemini     │    │    Supabase      │   │
│  │  Frontend   │◄──►│   AI API     │◄──►│    pgvector      │   │
│  │             │    │              │    │                  │   │
│  │  - Chat UI  │    │  - Embed     │    │  - 1,297 chunks  │   │
│  │  - Admin    │    │  - Chat      │    │  - 768 dims      │   │
│  │  - Landing  │    │  - Stream    │    │  - Similarity    │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│         │                                        ▲              │
│         │         ┌──────────────┐               │              │
│         └────────►│ ConfluxScan  │───────────────┘              │
│                   │  API         │                              │
│                   │              │                              │
│                   │  - Price     │                              │
│                   │  - Balance   │                              │
│                   │  - Txns      │                              │
│                   └──────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Chat Request Flow

```
User Question
     │
     ▼
┌─────────────────┐
│ Tool Detection  │──► Is it asking for live data?
└─────────────────┘
     │ Yes               │ No
     ▼                   ▼
┌─────────────┐   ┌─────────────┐
│ ConfluxScan │   │ Skip Tools  │
│ API Call    │   └─────────────┘
└─────────────┘          │
     │                   │
     ▼                   ▼
┌─────────────────────────────┐
│ Generate Query Embedding    │
│ (Gemini text-embedding-004) │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│ Vector Similarity Search    │
│ (Supabase pgvector)         │
│ → Returns top 5 documents   │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│ Build Context               │
│ = Tool Result + Documents   │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│ Generate Response           │
│ (Gemini 2.5 Flash Lite)     │
│ → Stream to client          │
└─────────────────────────────┘
     │
     ▼
User sees answer with citations
```

## Component Details

### Frontend (Next.js)

| Route | Description |
|-------|-------------|
| `/` | Landing page with features |
| `/chat` | Chat interface with streaming |
| `/admin` | Admin panel with auth |

### API Routes

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/chat` | POST | No | Streaming RAG chat |
| `/api/search` | POST | No | Direct vector search |
| `/api/admin/stats` | GET | Basic | Database stats |
| `/api/admin/sync` | POST | Basic | Trigger sync |

### Libraries

| File | Purpose |
|------|---------|
| `lib/gemini.ts` | Embedding & chat generation |
| `lib/supabase.ts` | Vector search queries |
| `lib/confluxscan.ts` | Blockchain API client |

## Database Schema

```sql
documents
├── id (bigserial, PK)
├── doc_id (text, unique)
├── title (text)
├── content (text)
├── section (text)
├── url (text)
├── keywords (text[])
├── embedding (vector(768))
└── created_at (timestamptz)
```

### Search Function

```sql
match_documents(
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_section text
) → table(doc_id, title, content, section, url, similarity)
```

## Ingestion Pipeline

```
Source Docs (Markdown)
     │
     ▼
┌─────────────┐
│ extract.js  │ → Parse frontmatter, clean MDX
└─────────────┘
     │
     ▼
┌─────────────┐
│ chunk.js    │ → 1000 chars, 200 overlap
└─────────────┘
     │
     ▼
┌─────────────┐
│ embed.js    │ → Gemini embeddings → Supabase
└─────────────┘
```

## Security

- Admin panel uses HTTP Basic Auth
- Service key only on server-side
- Environment variables for secrets
- No client-side API key exposure
