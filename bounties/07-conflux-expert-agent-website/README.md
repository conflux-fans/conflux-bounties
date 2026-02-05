# Confluxpedia

Confluxpedia is an AI-powered Knowledge Base and Expert Agent for the Conflux Network. It uses RAG (Retrieval-Augmented Generation) to provide accurate, context-aware answers to user queries about Conflux, utilizing the official documentation and other resources.

## Features

- **AI Expert Agent**: Ask questions about Conflux and get answers grounded in official documentation.
- **RAG Architecture**: Uses vector embeddings to retrieve relevant context before generating answers.
- **Source Citations**: Answers include citations to the source documentation for verification.
- **Modern UI**: A clean, responsive chat interface built with Next.js and Tailwind CSS.
- **Admin Dashboard**: Tools for managing knowledge base indexing and synchronization.

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Lucide Icons
- **Backend/Database**: Supabase (PostgreSQL + pgvector)
- **AI/ML**: OpenAI API (Embeddings & Chat Completion) or compatible LLMs
- **Data Processing**: Node.js scripts for extraction, chunking, and embedding

## Project Structure

- `/web`: The Next.js frontend application.
- `/scripts`: Node.js scripts for data extraction (`extract.js`), chunking (`chunk.js`), embedding (`embed.js`), and search testing (`search.js`).
- `/supabase`: Database schema and migration files.
- `/docs`: Project documentation and architecture details.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Supabase account and project
- OpenAI API Key (or other LLM provider)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ItshMoh/confluxpedia.git
   cd confluxpedia
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd web && npm install
   ```

3. **Environment Setup**
   Copy `.env.example` to `.env` and fill in your credentials.
   ```bash
   cp .env.example .env
   ```

4. **Database Setup**
   Run the schema script in your Supabase SQL editor:
   `supabase/schema.sql`

5. **Ingest Data**
   Run the processing pipeline to populate your vector database:
   ```bash
   npm run extract
   npm run chunk
   npm run embed
   ```

6. **Run the Application**
   ```bash
   cd web
   npm run dev
   ```

## License

MIT
