-- Find all Elena Voss articles across all tables
-- Run in Supabase Dashboard → SQL Editor → Run

-- 1. persona_memory — all article entries
select
  'persona_memory'                as source_table,
  metadata->>'slug'               as slug,
  metadata->>'title'              as title,
  metadata->>'topic'              as topic,
  metadata->>'source'             as source_type,
  created_at
from persona_memory
where persona_id = 'elena-voss'
  and memory_type = 'article'
order by created_at desc;

-- 2. persona_runs — all run entries (proactive + RSS)
select
  'persona_runs'    as source_table,
  article_slug      as slug,
  topic,
  primary_signal,
  score,
  should_write,
  run_date,
  created_at
from persona_runs
where persona_id = 'elena-voss'
order by created_at desc;

-- 3. article_queue — done items assigned to elena
select
  'article_queue'   as source_table,
  id,
  title,
  score,
  urgency,
  assigned_persona,
  status,
  processed_at
from article_queue
where assigned_persona = 'elena-voss'
  and status = 'done'
order by processed_at desc;

-- 4. coverage_log — RSS articles logged for elena
select
  'coverage_log'    as source_table,
  slug,
  title,
  generation_type,
  published_at
from coverage_log
where persona_id = 'elena-voss'
order by published_at desc;
