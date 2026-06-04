-- Email subscribers with double opt-in (DOI) support
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists subscribers (
  id              uuid        primary key default gen_random_uuid(),
  email           text        not null unique,
  confirm_token   uuid        not null default gen_random_uuid(),
  status          text        not null default 'pending'
                              check (status in ('pending', 'confirmed', 'unsubscribed')),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now(),
  source          text        not null default 'web'
);

create index if not exists subscribers_email_idx         on subscribers(email);
create index if not exists subscribers_token_idx         on subscribers(confirm_token);
create index if not exists subscribers_status_idx        on subscribers(status);
create index if not exists subscribers_confirmed_at_idx  on subscribers(confirmed_at desc)
  where status = 'confirmed';
