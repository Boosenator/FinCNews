-- Email campaign drafts created by the email-planner agent
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists email_campaigns (
  id               uuid        primary key default gen_random_uuid(),
  type             text        not null check (type in ('breaking', 'digest')),
  status           text        not null default 'draft'
                               check (status in ('draft', 'sent', 'rejected')),

  -- Content
  subject          text        not null,
  preheader        text,
  headline         text,
  excerpt          text,

  -- Breaking: single article
  article_slug     text,
  article_url      text,       -- URL with UTM params

  -- Digest: array of articles
  articles         jsonb       not null default '[]',

  -- Send stats
  recipients_count int,
  sent_at          timestamptz,
  rejected_at      timestamptz,

  -- Agent metadata
  agent_notes      text,
  created_at       timestamptz not null default now()
);

create index if not exists email_campaigns_status_idx     on email_campaigns(status);
create index if not exists email_campaigns_type_idx       on email_campaigns(type);
create index if not exists email_campaigns_created_at_idx on email_campaigns(created_at desc);
