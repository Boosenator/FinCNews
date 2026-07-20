-- Full audit: all 3 writers + Victor Kane activity
-- Run in Supabase Dashboard → SQL Editor → Run

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. PERSONA RUNS — all writers, chronological
-- ═══════════════════════════════════════════════════════════════════════════
select
  persona_id,
  run_date,
  should_write,
  score,
  topic,
  primary_signal,
  article_slug,
  left(reasoning, 80) as reasoning_short,
  created_at
from persona_runs
where persona_id in ('elena-voss', 'marcus-webb', 'leo-cruz')
order by created_at desc
limit 30;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. SUMMARY: how many articles each writer published, proactive vs RSS
-- ═══════════════════════════════════════════════════════════════════════════
select
  persona_id,
  count(*) filter (where should_write = true)                        as total_published,
  count(*) filter (where should_write = true and primary_signal like 'rss:%') as rss_articles,
  count(*) filter (where should_write = true and primary_signal not like 'rss:%') as proactive_articles,
  count(*) filter (where should_write = false)                       as silent_runs,
  round(avg(score) filter (where should_write = true), 1)            as avg_score,
  max(run_date)                                                       as last_active
from persona_runs
where persona_id in ('elena-voss', 'marcus-webb', 'leo-cruz')
group by persona_id
order by persona_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PERSONA MEMORY — recent articles in memory (what they remember)
-- ═══════════════════════════════════════════════════════════════════════════
select
  persona_id,
  metadata->>'title'  as title,
  metadata->>'topic'  as topic,
  metadata->>'source' as source,
  metadata->>'slug'   as slug,
  created_at::date    as date
from persona_memory
where persona_id in ('elena-voss', 'marcus-webb', 'leo-cruz')
  and memory_type = 'article'
order by created_at desc
limit 20;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. VICTOR KANE — editorial sessions + feedback given
-- ═══════════════════════════════════════════════════════════════════════════
select
  es.session_date,
  es.desk_note,
  es.ran_at,
  count(ef.id) as feedback_count
from editorial_sessions es
left join editorial_feedback ef on ef.session_id = es.id
group by es.id, es.session_date, es.desk_note, es.ran_at
order by es.session_date desc
limit 10;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. VICTOR KANE — scores he gave per persona per session
-- ═══════════════════════════════════════════════════════════════════════════
select
  es.session_date,
  ef.persona_id,
  ef.score,
  ef.article_slug,
  left(ef.priority_fix, 80) as priority_fix,
  left(ef.directive, 80)    as directive
from editorial_feedback ef
join editorial_sessions es on es.id = ef.session_id
order by es.session_date desc, ef.persona_id
limit 30;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. ACTIVE DIRECTIVES — what Victor told each writer to do next
-- ═══════════════════════════════════════════════════════════════════════════
select
  persona_id,
  status,
  issued_date,
  left(directive, 120) as directive,
  target_article_slug,
  resolved_at
from editorial_directives
order by issued_date desc, persona_id
limit 20;
