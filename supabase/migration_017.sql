-- RSS Pipeline: coverage_log table + article_queue triage columns
-- Requires pgvector (already enabled in migration_010.sql)
-- Run in Supabase Dashboard → SQL Editor → Run

-- 1. Shared coverage map across all article types (proactive + RSS)
create table if not exists coverage_log (
  id              uuid        primary key default gen_random_uuid(),
  embedding       vector(1536),              -- OpenAI text-embedding-3-small (nullable)
  title           text        not null,
  excerpt         text,
  slug            text        not null,
  persona_id      text,
  generation_type text        check (generation_type in ('rss', 'proactive')),
  source_url      text,
  published_at    timestamptz not null default now()
);

create index if not exists coverage_log_published_idx on coverage_log(published_at desc);
create index if not exists coverage_log_persona_idx   on coverage_log(persona_id);
create index if not exists coverage_log_slug_idx      on coverage_log(slug);

-- Uncomment after first batch of embeddings is stored:
-- create index on coverage_log using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- 2. article_queue: triage result columns
alter table article_queue
  add column if not exists urgency          text        check (urgency in ('breaking', 'standard')),
  add column if not exists expires_at       timestamptz,
  add column if not exists assigned_persona text,
  add column if not exists article_type     text        check (article_type in ('new', 'continuation')),
  add column if not exists continuation_of  text;       -- slug of original article

create index if not exists article_queue_urgency_idx  on article_queue(urgency, score desc);
create index if not exists article_queue_persona_idx  on article_queue(assigned_persona);

-- 3. persona_memory: allow 'rss' source in metadata.source (no schema change needed)
--    RSS articles use memory_type = 'article' with metadata = { ..., source: "rss" }
