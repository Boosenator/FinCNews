-- Persona memory: stores past articles and context for semantic retrieval
-- Requires pgvector extension (enabled by default in Supabase)
-- Run in Supabase Dashboard → SQL Editor → Run

create extension if not exists vector;

create table if not exists persona_memory (
  id            uuid        primary key default gen_random_uuid(),
  persona_id    text        not null references personas(id) on delete cascade,
  memory_type   text        not null
                            check (memory_type in ('article', 'forecast', 'position', 'context')),

  -- Content
  content       text        not null,   -- article excerpt or context text used for similarity search
  metadata      jsonb       not null default '{}',
  -- metadata examples:
  --   article:  { "slug": "...", "title": "...", "topic": "...", "sanity_id": "..." }
  --   forecast: { "metric": "btc_price", "condition": "decline > 5%", "timeframe_hours": 72, "status": "open|closed", "result": true|false }
  --   position: { "asset": "BTC", "stance": "bearish", "reason": "..." }

  -- pgvector: nullable for Phase 1, populated once embedding service is wired up
  -- dimensions: 1536 (OpenAI text-embedding-3-small compatible)
  embedding     vector(1536),

  created_at    timestamptz not null default now()
);

create index if not exists persona_memory_persona_idx   on persona_memory(persona_id);
create index if not exists persona_memory_type_idx      on persona_memory(persona_id, memory_type);
create index if not exists persona_memory_created_idx   on persona_memory(created_at desc);

-- Vector similarity index (IVFFlat) — only useful once embeddings are populated
-- Uncomment after first batch of embeddings is stored:
-- create index on persona_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);
