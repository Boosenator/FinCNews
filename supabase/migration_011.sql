-- Persona runs: daily run log — who ran, what they decided, why
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists persona_runs (
  id             uuid        primary key default gen_random_uuid(),
  persona_id     text        not null references personas(id) on delete cascade,
  run_date       date        not null default current_date,

  -- Editorial decision
  should_write   boolean     not null,
  score          int         not null check (score between 0 and 100),
  reasoning      text        not null,
  topic          text,                    -- null when silent
  primary_signal text,                    -- e.g. 'fed_language', 'cpi_data', 'new_trending'

  -- Output (filled after successful generation)
  article_slug   text,
  article_id     text,                    -- Sanity document _id

  -- Raw data snapshot for debugging and audit
  data_snapshot  jsonb       not null default '{}',

  created_at     timestamptz not null default now()
);

create index if not exists persona_runs_persona_idx    on persona_runs(persona_id);
create index if not exists persona_runs_date_idx       on persona_runs(run_date desc);
create index if not exists persona_runs_wrote_idx      on persona_runs(persona_id, should_write);
