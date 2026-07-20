-- Personas: config table for AI editorial personas (Elena Voss, Marcus Webb, Leo Cruz)
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists personas (
  id            text        primary key,          -- 'elena-voss', 'marcus-webb', 'leo-cruz'
  display_name  text        not null,             -- 'Elena Voss'
  role          text        not null,             -- 'Macro Bear'
  avatar_path   text,                             -- '/authors/elena-voss.png'
  system_prompt text        not null,
  eval_prompt   text        not null,             -- should_write LLM prompt template
  config        jsonb       not null default '{}',-- thresholds, sources, schedules
  is_active     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
