-- Run this SQL in your Supabase project: Dashboard → SQL Editor → Run

-- RSS sources to monitor
create table if not exists rss_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  category text not null check (category in ('crypto','markets','economy','fintech','policy','companies')),
  enabled boolean not null default true,
  last_fetched_at timestamptz,
  articles_published int not null default 0,
  created_at timestamptz not null default now()
);

-- Deduplication: URLs already processed
create table if not exists processed_urls (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  slug text,
  title text,
  category text,
  published_at timestamptz not null default now()
);

-- Log of each automation run
create table if not exists run_logs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','error','partial')),
  articles_found int not null default 0,
  articles_published int not null default 0,
  articles_skipped int not null default 0,
  duration_ms int,
  error_text text,
  details jsonb default '[]'::jsonb
);

-- Seed default RSS sources
insert into rss_sources (name, url, category) values
  ('CoinDesk',        'https://www.coindesk.com/arc/outboundfeeds/rss/', 'crypto'),
  ('CoinTelegraph',   'https://cointelegraph.com/rss',                  'crypto'),
  ('The Block',       'https://www.theblock.co/rss.xml',                'crypto'),
  ('Decrypt',         'https://decrypt.co/feed',                        'crypto'),
  ('BeInCrypto',      'https://beincrypto.com/feed/',                   'crypto'),
  ('NewsBTC',         'https://www.newsbtc.com/feed/',                  'crypto'),
  ('Bitcoin Magazine','https://bitcoinmagazine.com/feed',               'crypto'),
  ('CryptoSlate',     'https://cryptoslate.com/feed/',                  'crypto'),
  ('Reuters Finance', 'https://feeds.reuters.com/reuters/businessNews', 'economy'),
  ('CNBC Crypto',     'https://www.cnbc.com/id/10000664/device/rss/rss.html', 'markets')
on conflict (url) do nothing;

-- Index for fast dedup lookups
create index if not exists processed_urls_url_idx on processed_urls(url);
create index if not exists run_logs_started_at_idx on run_logs(started_at desc);
