-- Editorial Desk tables for Victor Kane's feedback system
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists editorial_sessions (
  id           uuid        primary key default gen_random_uuid(),
  session_date date        unique not null,
  ran_at       timestamptz not null default now(),
  desk_note    text,
  raw_output   jsonb       not null default '{}'
);

create index if not exists editorial_sessions_date_idx on editorial_sessions(session_date desc);

create table if not exists editorial_feedback (
  id           uuid        primary key default gen_random_uuid(),
  session_id   uuid        references editorial_sessions on delete cascade,
  persona_id   text        not null,
  article_slug text,
  score        int         check (score between 0 and 100),
  strengths    text[]      not null default '{}',
  priority_fix text        not null default '',
  directive    text        not null default '',
  pattern_warn text,
  created_at   timestamptz not null default now()
);

create index if not exists editorial_feedback_session_idx  on editorial_feedback(session_id);
create index if not exists editorial_feedback_persona_idx  on editorial_feedback(persona_id);

create table if not exists editorial_directives (
  id                  uuid        primary key default gen_random_uuid(),
  feedback_id         uuid        references editorial_feedback on delete cascade,
  persona_id          text        not null,
  directive           text        not null,
  issued_date         date        not null,
  target_article_slug text,
  status              text        not null default 'pending'
                                  check (status in ('pending','resolved','missed')),
  resolved_at         timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists editorial_directives_persona_idx on editorial_directives(persona_id);
create index if not exists editorial_directives_status_idx  on editorial_directives(persona_id, status);
