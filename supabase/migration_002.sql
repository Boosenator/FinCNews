-- Article queue: items collected from RSS, waiting to be generated
create table if not exists article_queue (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text,
  snippet text,
  source_category text not null default 'crypto',
  source_name text,
  pub_date text,
  queued_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending','processing','done','error')),
  processed_at timestamptz,
  error_text text
);

create index if not exists article_queue_status_idx
  on article_queue(status, queued_at asc);
