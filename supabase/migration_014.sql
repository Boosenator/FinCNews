-- Add 'baseline' memory type for Marcus Webb rolling metric baseline
-- Run in Supabase Dashboard → SQL Editor → Run

alter table persona_memory
  drop constraint if exists persona_memory_memory_type_check;

alter table persona_memory
  add constraint persona_memory_memory_type_check
  check (memory_type in ('article', 'forecast', 'position', 'context', 'narrative', 'baseline'));
