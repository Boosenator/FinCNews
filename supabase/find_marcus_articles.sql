-- Find all Marcus Webb articles across all tables

-- 1. coverage_log
select 'coverage_log' as src, slug, title, generation_type, published_at
from coverage_log where persona_id = 'marcus-webb' order by published_at desc;

-- 2. persona_memory
select 'persona_memory' as src, metadata->>'slug' as slug, metadata->>'title' as title,
  metadata->>'source' as source_type, created_at
from persona_memory where persona_id = 'marcus-webb' and memory_type = 'article'
order by created_at desc;

-- 3. persona_runs
select 'persona_runs' as src, article_slug as slug, topic, primary_signal, score, run_date
from persona_runs where persona_id = 'marcus-webb' order by created_at desc;

-- 4. article_queue done
select 'article_queue' as src, id, title, score, processed_at
from article_queue where assigned_persona = 'marcus-webb' and status = 'done'
order by processed_at desc;
