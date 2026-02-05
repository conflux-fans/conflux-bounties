-- ============================================
-- Confluxpedia Vector Search Schema (GEMINI)
-- Run this in Supabase SQL Editor
-- NOTE: Using 768 dimensions for Gemini text-embedding-004
-- ============================================

-- Step 1: Drop existing table if exists (to change dimensions)
drop table if exists documents;

-- Step 2: Enable the pgvector extension
create extension if not exists vector;

-- Step 3: Create the documents table (768 dimensions for Gemini)
create table documents (
  id bigserial primary key,
  doc_id text not null,
  chunk_index int not null,
  title text,
  section text,
  url text,
  content text not null,
  metadata jsonb,
  embedding vector(768) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  
  unique(doc_id, chunk_index)
);

-- Step 4: Create index for faster similarity search
create index documents_embedding_idx 
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Step 5: Create index for filtering by section
create index documents_section_idx on documents (section);

-- Step 6: Create a function to search for similar documents
create or replace function match_documents (
  query_embedding vector(768),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_section text default null
)
returns table (
  id bigint,
  doc_id text,
  chunk_index int,
  title text,
  section text,
  url text,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.doc_id,
    d.chunk_index,
    d.title,
    d.section,
    d.url,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where 
    1 - (d.embedding <=> query_embedding) > match_threshold
    and (filter_section is null or d.section = filter_section)
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
