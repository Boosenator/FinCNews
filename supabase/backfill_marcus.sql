-- Backfill Marcus Webb RSS articles
-- Source: article_queue (done) joined with processed_urls for slug

-- Step 1: find slugs via processed_urls
select
  aq.id,
  aq.title         as queue_title,
  aq.score,
  aq.urgency,
  pu.slug,
  pu.category,
  pu.title         as published_title,
  aq.processed_at
from article_queue aq
join processed_urls pu on pu.url = aq.url
where aq.assigned_persona = 'marcus-webb'
  and aq.status = 'done'
order by aq.processed_at desc;

-- Step 2: backfill persona_runs + persona_memory from the join result
-- persona_runs
insert into persona_runs (
  persona_id, should_write, score, reasoning, topic,
  primary_signal, article_slug, data_snapshot, run_date, created_at
)
select
  'marcus-webb',
  true,
  aq.score,
  'RSS desk: ' || coalesce(pu.title, aq.title),
  null,
  'rss:' || coalesce(aq.urgency, 'standard'),
  pu.slug,
  jsonb_build_object(
    'source',           'rss',
    'article_category', pu.category,
    'source_url',       aq.url,
    'backfilled',       true
  ),
  (aq.processed_at at time zone 'utc')::date,
  aq.processed_at
from article_queue aq
join processed_urls pu on pu.url = aq.url
where aq.assigned_persona = 'marcus-webb'
  and aq.status = 'done'
  and pu.slug is not null
  and not exists (
    select 1 from persona_runs pr
    where pr.persona_id = 'marcus-webb'
      and pr.article_slug = pu.slug
  );

-- persona_memory
insert into persona_memory (
  persona_id, memory_type, content, metadata, created_at
)
select
  'marcus-webb',
  'article',
  coalesce(pu.title, aq.title),
  jsonb_build_object(
    'title',        coalesce(pu.title, aq.title),
    'slug',         pu.slug,
    'topic',        null,
    'source',       'rss',
    'generated_at', aq.processed_at
  ),
  aq.processed_at
from article_queue aq
join processed_urls pu on pu.url = aq.url
where aq.assigned_persona = 'marcus-webb'
  and aq.status = 'done'
  and pu.slug is not null
  and not exists (
    select 1 from persona_memory pm
    where pm.persona_id = 'marcus-webb'
      and pm.memory_type = 'article'
      and pm.metadata->>'slug' = pu.slug
  );

-- Step 3: verify
select 'runs' as tbl, article_slug, score, run_date from persona_runs
  where persona_id = 'marcus-webb'
union all
select 'memory', metadata->>'slug', null, created_at::date from persona_memory
  where persona_id = 'marcus-webb' and memory_type = 'article'
order by run_date desc;
