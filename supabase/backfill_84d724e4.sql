-- Backfill for queue item 84d724e4-938c-4792-9de6-89e0349b221e
-- Step 1: find what was published
select
  id,
  title,
  url,
  assigned_persona,
  score,
  urgency,
  status,
  processed_at
from article_queue
where id = '84d724e4-938c-4792-9de6-89e0349b221e';

-- Step 2: find the article in coverage_log (if it was written)
select * from coverage_log order by published_at desc limit 5;

-- Step 3: find the article in persona_memory for leo-cruz (if it was written)
select id, content, metadata, created_at
from persona_memory
where persona_id = 'leo-cruz'
  and memory_type = 'article'
order by created_at desc limit 5;

-- Step 4: manually insert into persona_runs
-- FILL IN: replace <SLUG> with the actual slug of the published article
--          replace <TITLE> with the article title
--          replace <CATEGORY> with the article category (crypto/markets/etc)
--          replace <SCORE> with the score from article_queue
/*
insert into persona_runs (
  persona_id, should_write, score, reasoning, topic,
  primary_signal, article_slug, data_snapshot, run_date, created_at
) values (
  'leo-cruz',
  true,
  <SCORE>,
  'RSS desk: <TITLE>',
  null,
  'rss:standard',
  '<SLUG>',
  '{"source":"rss","article_category":"<CATEGORY>","backfilled":true}'::jsonb,
  current_date,
  now()
);
*/

-- Step 5: manually insert into persona_memory (if not already there)
/*
insert into persona_memory (persona_id, memory_type, content, metadata)
values (
  'leo-cruz',
  'article',
  '<EXCERPT>',
  '{"title":"<TITLE>","slug":"<SLUG>","topic":null,"source":"rss","generated_at":"<NOW>"}'::jsonb
);
*/
