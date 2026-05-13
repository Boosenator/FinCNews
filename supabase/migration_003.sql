-- Add hype score to article_queue
alter table article_queue
  add column if not exists score int not null default 50;

-- Optimal index: pending items sorted by score desc, then oldest first
drop index if exists article_queue_status_idx;
create index if not exists article_queue_pending_idx
  on article_queue(status, score desc, queued_at asc)
  where status = 'pending';
