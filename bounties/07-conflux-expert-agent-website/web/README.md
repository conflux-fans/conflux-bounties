# Confluxpedia - AI-Powered Conflux Expert Agent

An MVP AI assistant that answers Conflux blockchain questions using Retrieval-Augmented Generation (RAG) with citation-backed responses.

![Confluxpedia Chat](docs/chat-screenshot.png)

## Features

- 🔍 **RAG-Powered Answers** - Grounded in official Conflux documentation
- 📚 **Citation Support** - Every answer links to source documents
- ⚡ **Live Blockchain Data** - Real-time CFX price, balances via ConfluxScan API
- 🌊 **Streaming Responses** - Real-time AI response streaming
- 🔐 **Admin Panel** - Dashboard with sync controls and stats
- 🌙 **Dark Mode** - Modern dark UI with violet accents

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 16+ (App Router) |
| Styling | Tailwind CSS |
| Vector DB | Supabase pgvector (768 dims) |
| Embeddings | Gemini text-embedding-004 |
| Chat LLM | Gemini 2.5 Flash Lite |
| Live Data | ConfluxScan API |
| Deployment | Vercel-ready |

## Quick Start

### Prerequisites

- Node.js 20+ 
- Supabase account (free tier works)
- Gemini API key (via Google AI Studio or OpenRouter)

### 1. Clone & Install

```bash
git clone <repo-url>
cd confluxpedia2/web
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project
2. Go to SQL Editor and run:

```sql
-- Enable pgvector
create extension if not exists vector;

-- Create documents table
create table documents (
  id bigserial primary key,
  doc_id text unique not null,
  title text not null,
  content text not null,
  section text,
  url text,
  keywords text[],
  embedding vector(768),
  created_at timestamptz default now()
);

-- Create search function
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float default 0.5,
  match_count int default 5,
  filter_section text default null
)
returns table (
  doc_id text,
  title text,
  content text,
  section text,
  url text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.doc_id,
    d.title,
    d.content,
    d.section,
    d.url,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where (filter_section is null or d.section = filter_section)
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create index
create index on documents using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

### 3. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
ADMIN_PASSWORD=your-admin-password
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

## Project Structure

```
confluxpedia2/
├── data/                   # Document data
│   ├── raw/                # Source markdown files
│   └── processed/          # Chunks and embeddings
├── scripts/                # CLI tools
│   ├── extract.js          # Extract docs from sources
│   ├── chunk.js            # Split into chunks
│   ├── embed.js            # Generate embeddings
│   └── search.js           # Test search CLI
├── web/                    # Next.js application
│   └── src/
│       ├── app/
│       │   ├── page.tsx         # Landing page
│       │   ├── chat/            # Chat interface
│       │   ├── admin/           # Admin panel
│       │   └── api/             # API routes
│       └── lib/
│           ├── gemini.ts        # AI client
│           ├── supabase.ts      # Vector search
│           └── confluxscan.ts   # Blockchain API
├── supabase/
│   └── schema.sql          # Database schema
└── docs/                   # Documentation
```

## API Endpoints

### Chat (Streaming)
```
POST /api/chat
Body: { message: string, history?: Array<{role, content}> }
Returns: Server-Sent Events stream
```

### Search
```
POST /api/search
Body: { query: string, section?: string, limit?: number }
Returns: { query, results: Array<{title, content, similarity}> }
```

### Admin Stats
```
GET /api/admin/stats
Headers: Authorization: Basic base64(admin:password)
Returns: { totalDocuments, sectionBreakdown, recentDocuments }
```

### Admin Sync
```
POST /api/admin/sync
Headers: Authorization: Basic base64(admin:password)
Returns: { message, status: { isRunning, progress, lastMessage } }
```

## Ingestion Pipeline

To update the knowledge base:

```bash
# From project root (not web/)
npm run chunk     # Process documents into chunks
npm run embed     # Generate embeddings and upload
```

Or use the Admin Panel to trigger sync manually.

## Deployment

### Vercel

1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

### Environment Variables for Production

```
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
ADMIN_PASSWORD=...
NEXT_PUBLIC_SITE_NAME=Confluxpedia
```

## Tool Integration

The chat automatically detects queries needing live data:

| Query Pattern | Tool Called |
|---------------|-------------|
| "CFX price" | `get_cfx_price` |
| "balance of 0x..." | `get_account_balance` |
| "transactions for 0x..." | `get_recent_transactions` |
| "contract 0x..." | `get_contract_info` |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Acknowledgments

- Built for [Conflux Bounty #07](https://github.com/conflux-fans/conflux-bounties/issues/13)
- Powered by Gemini AI and Supabase
