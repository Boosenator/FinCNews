-- Run in Supabase SQL Editor to add pipeline debug counters to run_logs
alter table run_logs
  add column if not exists articles_after_keywords int not null default 0,
  add column if not exists articles_after_url_dedup int not null default 0,
  add column if not exists articles_after_semantic_dedup int not null default 0;
