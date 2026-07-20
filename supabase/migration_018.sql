-- migration_018: backfill persona_runs for RSS articles
-- Source of truth: coverage_log (generation_type = 'rss')
-- Run in Supabase Dashboard → SQL Editor → Run

-- ── Step 1: Diagnostics ────────────────────────────────────────────────────────
-- Run these first to see what data exists:

-- How many RSS entries in coverage_log?
select persona_id, count(*) as rss_count
from coverage_log
where generation_type = 'rss'
group by persona_id;

-- How many persona_memory entries with source='rss'?
select persona_id, count(*) as mem_count
from persona_memory
where memory_type = 'article'
  and metadata->>'source' = 'rss'
group by persona_id;

-- ── Step 2: Backfill from coverage_log ────────────────────────────────────────
insert into persona_runs (
  persona_id,
  should_write,
  score,
  reasoning,
  topic,
  primary_signal,
  article_slug,
  data_snapshot,
  run_date,
  created_at
)
select
  cl.persona_id,
  true                                                             as should_write,
  60                                                               as score,
  'RSS desk: ' || cl.title                                         as reasoning,
  null                                                             as topic,
  'rss:standard'                                                   as primary_signal,
  cl.slug                                                          as article_slug,
  jsonb_build_object(
    'source',           'rss',
    'article_category', 'crypto',
    'source_url',       cl.source_url,
    'backfilled',       true
  )                                                                as data_snapshot,
  (cl.published_at at time zone 'utc')::date                       as run_date,
  cl.published_at                                                  as created_at
from coverage_log cl
where cl.generation_type = 'rss'
  and cl.persona_id is not null
  -- skip if a persona_run already exists for this slug
  and not exists (
    select 1
    from persona_runs pr
    where pr.persona_id  = cl.persona_id
      and pr.article_slug = cl.slug
  );

-- ── Step 3: Backfill from persona_memory (fallback) ────────────────────────────
-- Catches any articles written to persona_memory but not coverage_log
insert into persona_runs (
  persona_id,
  should_write,
  score,
  reasoning,
  topic,
  primary_signal,
  article_slug,
  data_snapshot,
  run_date,
  created_at
)
select
  pm.persona_id,
  true                                                                  as should_write,
  60                                                                    as score,
  'RSS desk: ' || coalesce(pm.metadata->>'title', '(no title)')         as reasoning,
  pm.metadata->>'topic'                                                 as topic,
  'rss:standard'                                                        as primary_signal,
  pm.metadata->>'slug'                                                  as article_slug,
  jsonb_build_object(
    'source',           'rss',
    'article_category', 'crypto',
    'backfilled',       true
  )                                                                     as data_snapshot,
  (pm.created_at at time zone 'utc')::date                              as run_date,
  pm.created_at
from persona_memory pm
where pm.memory_type = 'article'
  and pm.metadata->>'source' = 'rss'
  and pm.metadata->>'slug' is not null
  and not exists (
    select 1
    from persona_runs pr
    where pr.persona_id  = pm.persona_id
      and pr.article_slug = pm.metadata->>'slug'
  );

-- ── Step 4: Verify result ──────────────────────────────────────────────────────
select persona_id, primary_signal, article_slug, run_date
from persona_runs
where primary_signal like 'rss:%'
order by created_at desc
limit 20;
