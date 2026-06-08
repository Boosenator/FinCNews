-- ============================================================
-- FinCNews — повна схема БД
-- Еквівалент: schema.sql + migration_001..019
-- Запускати на чистій БД (replace all existing migrations)
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists vector;

-- ════════════════════════════════════════════════════════════
-- 1. RSS PIPELINE
-- ════════════════════════════════════════════════════════════

create table if not exists rss_sources (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  url               text        not null unique,
  category          text        not null check (category in ('crypto','markets','economy','fintech','policy','companies')),
  enabled           boolean     not null default true,
  last_fetched_at   timestamptz,
  articles_published int        not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists processed_urls (
  id           uuid        primary key default gen_random_uuid(),
  url          text        not null unique,
  slug         text,
  title        text,
  category     text,
  published_at timestamptz not null default now()
);

create index if not exists processed_urls_url_idx on processed_urls(url);

create table if not exists run_logs (
  id                           uuid        primary key default gen_random_uuid(),
  started_at                   timestamptz not null default now(),
  finished_at                  timestamptz,
  status                       text        not null default 'running'
                                           check (status in ('running','success','error','partial')),
  articles_found               int         not null default 0,
  articles_published           int         not null default 0,
  articles_skipped             int         not null default 0,
  articles_after_keywords      int         not null default 0,
  articles_after_url_dedup     int         not null default 0,
  articles_after_semantic_dedup int        not null default 0,
  duration_ms                  int,
  error_text                   text,
  details                      jsonb       default '[]'::jsonb,
  steps                        jsonb,
  run_type                     text        not null default 'generate'
);

create index if not exists run_logs_started_at_idx on run_logs(started_at desc);

create table if not exists article_queue (
  id               uuid        primary key default gen_random_uuid(),
  url              text        not null unique,
  title            text,
  snippet          text,
  source_category  text        not null default 'crypto',
  source_name      text,
  pub_date         text,
  score            int         not null default 50,
  queued_at        timestamptz not null default now(),
  status           text        not null default 'pending'
                               check (status in ('pending','processing','done','error')),
  processed_at     timestamptz,
  error_text       text,
  -- triage columns (migration_017)
  urgency          text        check (urgency in ('breaking','standard')),
  expires_at       timestamptz,
  assigned_persona text,
  article_type     text        check (article_type in ('new','continuation')),
  continuation_of  text
);

create index if not exists article_queue_pending_idx
  on article_queue(status, score desc, queued_at asc)
  where status = 'pending';
create index if not exists article_queue_urgency_idx on article_queue(urgency, score desc);
create index if not exists article_queue_persona_idx on article_queue(assigned_persona);

create table if not exists pipeline_config (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

insert into pipeline_config (key, value) values
  ('collect_enabled',      'true'),
  ('generate_enabled',     'true'),
  ('generate_max_per_run', '1'),
  ('min_score',            '60')
on conflict (key) do nothing;

-- Coverage log: unified tracking for proactive + RSS articles (migration_017)
create table if not exists coverage_log (
  id              uuid        primary key default gen_random_uuid(),
  embedding       vector(1536),
  title           text        not null,
  excerpt         text,
  slug            text        not null,
  persona_id      text,
  generation_type text        check (generation_type in ('rss','proactive')),
  source_url      text,
  published_at    timestamptz not null default now()
);

create index if not exists coverage_log_published_idx on coverage_log(published_at desc);
create index if not exists coverage_log_persona_idx   on coverage_log(persona_id);
create index if not exists coverage_log_slug_idx      on coverage_log(slug);
-- Uncomment after ≥100 embeddings:
-- create index on coverage_log using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Default RSS sources
insert into rss_sources (name, url, category) values
  ('CoinDesk',         'https://www.coindesk.com/arc/outboundfeeds/rss/', 'crypto'),
  ('CoinTelegraph',    'https://cointelegraph.com/rss',                   'crypto'),
  ('The Block',        'https://www.theblock.co/rss.xml',                 'crypto'),
  ('Decrypt',          'https://decrypt.co/feed',                         'crypto'),
  ('BeInCrypto',       'https://beincrypto.com/feed/',                    'crypto'),
  ('NewsBTC',          'https://www.newsbtc.com/feed/',                   'crypto'),
  ('Bitcoin Magazine', 'https://bitcoinmagazine.com/feed',                'crypto'),
  ('CryptoSlate',      'https://cryptoslate.com/feed/',                   'crypto'),
  ('Reuters Finance',  'https://feeds.reuters.com/reuters/businessNews',  'economy'),
  ('CNBC Crypto',      'https://www.cnbc.com/id/10000664/device/rss/rss.html', 'markets')
on conflict (url) do nothing;

-- ════════════════════════════════════════════════════════════
-- 2. EMAIL
-- ════════════════════════════════════════════════════════════

create table if not exists subscribers (
  id              uuid        primary key default gen_random_uuid(),
  email           text        not null unique,
  confirm_token   uuid        not null default gen_random_uuid(),
  status          text        not null default 'pending'
                              check (status in ('pending','confirmed','unsubscribed')),
  confirmed_at    timestamptz,
  unsubscribed_at timestamptz,
  created_at      timestamptz not null default now(),
  source          text        not null default 'web'
);

create index if not exists subscribers_email_idx        on subscribers(email);
create index if not exists subscribers_token_idx        on subscribers(confirm_token);
create index if not exists subscribers_status_idx       on subscribers(status);
create index if not exists subscribers_confirmed_at_idx on subscribers(confirmed_at desc)
  where status = 'confirmed';

create table if not exists email_logs (
  id        uuid        primary key default gen_random_uuid(),
  type      text        not null check (type in ('confirmation','welcome','breaking','digest')),
  recipient text        not null,
  subject   text,
  status    text        not null default 'sent' check (status in ('sent','failed')),
  resend_id text,
  error     text,
  sent_at   timestamptz not null default now()
);

create index if not exists email_logs_sent_at_idx on email_logs(sent_at desc);
create index if not exists email_logs_type_idx    on email_logs(type);
create index if not exists email_logs_status_idx  on email_logs(status);

create table if not exists email_campaigns (
  id               uuid        primary key default gen_random_uuid(),
  type             text        not null check (type in ('breaking','digest')),
  status           text        not null default 'draft'
                               check (status in ('draft','sent','rejected')),
  subject          text        not null,
  preheader        text,
  headline         text,
  excerpt          text,
  article_slug     text,
  article_url      text,
  articles         jsonb       not null default '[]',
  recipients_count int,
  sent_at          timestamptz,
  rejected_at      timestamptz,
  agent_notes      text,
  created_at       timestamptz not null default now()
);

create index if not exists email_campaigns_status_idx     on email_campaigns(status);
create index if not exists email_campaigns_type_idx       on email_campaigns(type);
create index if not exists email_campaigns_created_at_idx on email_campaigns(created_at desc);

-- Inbound email (migration_019)
create table if not exists inbound_email_logs (
  id           uuid        primary key default gen_random_uuid(),
  from_address text        not null,
  to_address   text        not null,
  subject      text,
  forwarded_to text,
  status       text        not null default 'forwarded'
                           check (status in ('forwarded','skipped','failed')),
  skip_reason  text,
  received_at  timestamptz not null default now()
);

create index if not exists inbound_email_logs_received_at_idx on inbound_email_logs(received_at desc);
create index if not exists inbound_email_logs_to_address_idx  on inbound_email_logs(to_address);

-- recipient = mailbox name ('editorial', 'ads', ...) або '*' для catch-all
create table if not exists email_routes (
  id         uuid        primary key default gen_random_uuid(),
  recipient  text        not null unique,
  forward_to text        not null default '',
  label      text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

insert into email_routes (recipient, forward_to, label) values
  ('editorial', '', 'Editorial'),
  ('privacy',   '', 'Privacy'),
  ('legal',     '', 'Legal'),
  ('ads',       '', 'Ads'),
  ('tech',      '', 'Tech'),
  ('*',         '', 'Catch-all')
on conflict (recipient) do nothing;

-- ════════════════════════════════════════════════════════════
-- 3. PERSONAS & MEMORY
-- ════════════════════════════════════════════════════════════

create table if not exists personas (
  id            text        primary key,
  display_name  text        not null,
  role          text        not null,
  avatar_path   text,
  system_prompt text        not null,
  eval_prompt   text        not null,
  config        jsonb       not null default '{}',
  is_active     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists persona_memory (
  id          uuid        primary key default gen_random_uuid(),
  persona_id  text        not null references personas(id) on delete cascade,
  memory_type text        not null check (memory_type in (
    -- content types
    'article', 'forecast', 'position', 'context',
    -- persona-specific
    'narrative',            -- Leo Cruz: narrative cycle tracking
    'baseline',             -- Marcus Webb: rolling metric baseline
    'signal_snapshot',      -- all: market data snapshot per run
    -- Victor Kane
    'editor_feedback', 'session', 'directive_history', 'editorial_standard',
    'hub_contribution', 'hub_review'
  )),
  content     text        not null,
  metadata    jsonb       not null default '{}',
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);

create index if not exists persona_memory_persona_idx on persona_memory(persona_id);
create index if not exists persona_memory_type_idx    on persona_memory(persona_id, memory_type);
create index if not exists persona_memory_created_idx on persona_memory(created_at desc);
-- Uncomment after ≥100 embeddings:
-- create index on persona_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists persona_runs (
  id             uuid        primary key default gen_random_uuid(),
  persona_id     text        not null references personas(id) on delete cascade,
  run_date       date        not null default current_date,
  should_write   boolean     not null,
  score          int         not null check (score between 0 and 100),
  reasoning      text        not null,
  topic          text,
  primary_signal text,
  article_slug   text,
  article_id     text,
  data_snapshot  jsonb       not null default '{}',
  created_at     timestamptz not null default now()
);

create index if not exists persona_runs_persona_idx on persona_runs(persona_id);
create index if not exists persona_runs_date_idx    on persona_runs(run_date desc);
create index if not exists persona_runs_wrote_idx   on persona_runs(persona_id, should_write);

-- Similarity search function
create or replace function match_persona_memories(
  p_persona_id    text,
  query_embedding vector(1536),
  match_threshold float   default 0.7,
  match_count     int     default 5
)
returns table (
  id          uuid,
  content     text,
  metadata    jsonb,
  memory_type text,
  similarity  float,
  created_at  timestamptz
)
language sql stable as $$
  select
    pm.id,
    pm.content,
    pm.metadata,
    pm.memory_type,
    1 - (pm.embedding <=> query_embedding) as similarity,
    pm.created_at
  from persona_memory pm
  where pm.persona_id  = p_persona_id
    and pm.embedding   is not null
    and pm.memory_type = 'article'
    and 1 - (pm.embedding <=> query_embedding) > match_threshold
  order by pm.embedding <=> query_embedding
  limit match_count;
$$;

-- ════════════════════════════════════════════════════════════
-- 4. VICTOR KANE — EDITORIAL DESK
-- ════════════════════════════════════════════════════════════

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

create index if not exists editorial_feedback_session_idx on editorial_feedback(session_id);
create index if not exists editorial_feedback_persona_idx on editorial_feedback(persona_id);

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
