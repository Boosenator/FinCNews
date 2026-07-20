-- Backfill Elena Voss RSS article from coverage_log
-- Article: KOSPI Circuit Breaker: Korea's Semiconductor Trap Exposed
-- Published: 2026-06-08 06:01:42 UTC

-- Step 1: get score from article_queue (by processed_at ≈ published_at)
select id, title, score, urgency, processed_at
from article_queue
where assigned_persona = 'elena-voss'
  and processed_at between '2026-06-08 05:55:00+00' and '2026-06-08 06:10:00+00'
order by processed_at desc
limit 5;

-- Step 2: insert into persona_runs
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
  'elena-voss',
  true,
  coalesce(
    (
      select score from article_queue
      where assigned_persona = 'elena-voss'
        and processed_at between '2026-06-08 05:55:00+00' and '2026-06-08 06:10:00+00'
      order by processed_at desc
      limit 1
    ),
    65
  ),
  'RSS desk: KOSPI Circuit Breaker: Korea''s Semiconductor Trap Exposed',
  'Korea',
  'rss:standard',
  'kospi-circuit-breaker-koreas-semiconductor-trap-exposed-mq4szdul',
  '{"source":"rss","article_category":"markets","backfilled":true}'::jsonb,
  '2026-06-08'::date,
  '2026-06-08T06:01:42.977+00'::timestamptz
where not exists (
  select 1 from persona_runs
  where persona_id = 'elena-voss'
    and article_slug = 'kospi-circuit-breaker-koreas-semiconductor-trap-exposed-mq4szdul'
);

-- Step 3: insert into persona_memory
insert into persona_memory (persona_id, memory_type, content, metadata, created_at)
select
  'elena-voss',
  'article',
  cl.excerpt,
  jsonb_build_object(
    'title',         cl.title,
    'slug',          cl.slug,
    'topic',         'Korea',
    'source',        'rss',
    'generated_at',  cl.published_at
  ),
  cl.published_at
from coverage_log cl
where cl.slug = 'kospi-circuit-breaker-koreas-semiconductor-trap-exposed-mq4szdul'
  and not exists (
    select 1 from persona_memory pm
    where pm.persona_id = 'elena-voss'
      and pm.memory_type = 'article'
      and pm.metadata->>'slug' = 'kospi-circuit-breaker-koreas-semiconductor-trap-exposed-mq4szdul'
  );

-- Step 4: verify
select 'persona_runs' as tbl, article_slug, score, run_date from persona_runs
where persona_id = 'elena-voss' and primary_signal like 'rss:%'
union all
select 'persona_memory', metadata->>'slug', null, created_at::date from persona_memory
where persona_id = 'elena-voss' and memory_type = 'article' and metadata->>'source' = 'rss';
