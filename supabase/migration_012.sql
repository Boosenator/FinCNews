-- pgvector similarity search function + IVFFlat index
-- Run AFTER migration_010.sql (which enables pgvector extension)
-- Run in Supabase Dashboard → SQL Editor → Run

-- Similarity search: returns persona memories ordered by cosine distance
-- Used by buildContext() to find semantically relevant past articles
create or replace function match_persona_memories(
  p_persona_id   text,
  query_embedding vector(1536),
  match_threshold float   default 0.7,
  match_count     int     default 5
)
returns table (
  id          uuid,
  content     text,
  metadata    jsonb,
  memory_type text,
  similarity  float,
  created_at  timestamptz
)
language sql stable
as $$
  select
    pm.id,
    pm.content,
    pm.metadata,
    pm.memory_type,
    1 - (pm.embedding <=> query_embedding) as similarity,
    pm.created_at
  from persona_memory pm
  where pm.persona_id    = p_persona_id
    and pm.embedding     is not null
    and pm.memory_type   = 'article'
    and 1 - (pm.embedding <=> query_embedding) > match_threshold
  order by pm.embedding <=> query_embedding
  limit match_count;
$$;

-- IVFFlat index for fast approximate nearest-neighbor search
-- Uncomment once you have at least 100 rows with embeddings
-- create index if not exists persona_memory_embedding_idx
--   on persona_memory using ivfflat (embedding vector_cosine_ops)
--   with (lists = 100);
