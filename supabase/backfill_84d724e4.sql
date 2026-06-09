-- Backfill persona_runs for ALL personas — RSS articles already in persona_memory
-- Run in Supabase Dashboard → SQL Editor → Run

-- ── Step 1: see what's in persona_memory (source=rss) across all personas ─────
select
  persona_id,
  metadata->>'slug'  as slug,
  metadata->>'title' as title,
  metadata->>'topic' as topic,
  created_at
from persona_memory
where memory_type = 'article'
  and metadata->>'source' = 'rss'
order by created_at desc;

-- ── Step 2: backfill persona_runs for all of them ─────────────────────────────
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
  true,
  coalesce(
    (
      select aq.score
      from article_queue aq
      where aq.assigned_persona = pm.persona_id
        and aq.status = 'done'
        and aq.processed_at between pm.created_at - interval '5 minutes'
                                and pm.created_at + interval '5 minutes'
      limit 1
    ),
    65
  )                                                                    as score,
  'RSS desk: ' || coalesce(pm.metadata->>'title', '(no title)')        as reasoning,
  pm.metadata->>'topic'                                                as topic,
  'rss:standard'                                                       as primary_signal,
  pm.metadata->>'slug'                                                 as article_slug,
  jsonb_build_object(
    'source',           'rss',
    'article_category', 'crypto',
    'backfilled',       true
  )                                                                    as data_snapshot,
  (pm.created_at at time zone 'utc')::date                             as run_date,
  pm.created_at
from persona_memory pm
where pm.memory_type = 'article'
  and pm.metadata->>'source' = 'rss'
  and pm.metadata->>'slug'   is not null
  and not exists (
    select 1 from persona_runs pr
    where pr.persona_id  = pm.persona_id
      and pr.article_slug = pm.metadata->>'slug'
  );

-- ── Step 3: verify all personas ───────────────────────────────────────────────
select persona_id, primary_signal, article_slug, score, run_date
from persona_runs
where primary_signal like 'rss:%'
order by created_at desc;
