-- Email send log — every outbound email recorded here
-- Run in Supabase Dashboard → SQL Editor → Run

create table if not exists email_logs (
  id         uuid        primary key default gen_random_uuid(),
  type       text        not null check (type in ('confirmation', 'welcome', 'breaking', 'digest')),
  recipient  text        not null,
  subject    text,
  status     text        not null default 'sent' check (status in ('sent', 'failed')),
  resend_id  text,
  error      text,
  sent_at    timestamptz not null default now()
);

create index if not exists email_logs_sent_at_idx on email_logs(sent_at desc);
create index if not exists email_logs_type_idx    on email_logs(type);
create index if not exists email_logs_status_idx  on email_logs(status);
