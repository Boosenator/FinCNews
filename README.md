# FinCNews

FinCNews is a Next.js content automation app for finance and crypto news. It collects RSS items, scores and queues stories, generates factual news articles with Claude, publishes to Sanity, creates Telegraph distribution pages, sends Telegram posts, maintains evergreen topic hubs for SEO, and runs an autonomous AI editorial system with three specialist personas overseen by a Chief Editor agent.

Production site: `https://finc.news`

## Stack

- Frontend: Next.js 14 App Router on Vercel
- CMS: Sanity project `x55aaanw`, dataset `production`
- Studio: `fincnews.sanity.studio`
- Queue / logs: Supabase (PostgreSQL + pgvector)
- Generation: Anthropic Claude (Sonnet 4.5 for personas, Haiku for RSS pipeline)
- Embeddings: OpenAI `text-embedding-3-small` (1536d, pgvector semantic search)
- Images: Pexels → Sanity assets
- Distribution: Telegraph + Telegram `@FinCNews`
- Email: Resend

## Core Routes

- `/` — homepage with latest articles, categories, and topic hubs
- `/[category]` — category archive
- `/[category]/page/[page]` — paginated category archive
- `/[category]/[slug]` — article page with persona byline
- `/topics` — topic hub index
- `/topics/[slug]` — evergreen topic hub
- `/author` — AI editorial team directory (Elena, Marcus, Leo)
- `/flows` — admin dashboard (protected by `ADMIN_KEY`)
- `/flows/editorial` — AI personas + content plan
- `/flows/email` — campaigns + subscribers
- `/flows/settings` — sources + pipeline + integrations
- `/sitemap.xml` — full sitemap
- `/news-sitemap.xml` — Google News sitemap
- `/robots.txt` — crawl rules

## Automation — Vercel Cron Schedules

### RSS Pipeline
- `/api/cron/collect` — every 30 min
- `/api/cron/generate` — hourly
- `/api/cron/editorial/morning` — `03:00 UTC`
- `/api/cron/editorial/evening` — `14:00 UTC`
- `/api/cron/editorial/discovery` — `02:30 UTC`

### AI Editorial Personas
- `/api/cron/elena` — `08:00 UTC` daily (Elena Voss, Macro Bear)
- `/api/cron/marcus` — `07:00 UTC` + `13:00 UTC` daily (Marcus Webb, On-Chain Analyst)
- `/api/cron/leo` — `10:00 UTC` daily (Leo Cruz, Narrative Hunter)
- `/api/cron/chief-editor` — `21:00 UTC` daily (Victor Kane, Chief Editor — evaluates all three)

### News Pipeline (RSS)

1. Fetch enabled RSS sources from Supabase.
2. Filter by recency and finance/crypto keywords.
3. Deduplicate by URL and title similarity.
4. Score stories for news value.
5. Queue top item for generation.
6. Fetch source article text when possible.
7. Generate structured news article with Claude Haiku.
8. Publish to Sanity through `/api/publish`.
9. Attach a Pexels cover image.
10. Create a unique Telegraph page linking back to the article.
11. Send a Telegram post.
12. Mark queue item as done and store processed URL.

### AI Editorial Pipeline (Personas)

Each persona runs independently on a cron schedule:

1. Pull live data from assigned sources (FRED, CoinGecko, CoinGlass, Reddit, etc.)
2. Evaluate signals (`should_write`) — LLM call with editorial judgment
3. If score ≥ 60: generate article → publish to Sanity
4. If score < 60: run self-work (bootstrap, weekly preview/summary, tracker update)
5. Fire-and-forget: save embeddings, extract forecasts/position/narrative state

Victor Kane runs at 21:00 UTC after all personas:
1. Collect today's articles from Sanity
2. Detect semantic overlap between articles (OpenAI embeddings)
3. Evaluate each published analyst in parallel (dedicated sonnet call per analyst)
4. Synthesize desk note (haiku)
5. Save feedback to each analyst's `persona_memory` → appears in their next `buildContext()`

### Topic Hub Pipeline

1. Run Topic Discovery Agent at 05:30 Kyiv to suggest new evergreen hub candidates.
2. Admins approve, dismiss, or create hubs from Content Plan.
3. Refresh one hub in the morning and one in the evening.
4. Store public Sanity documents as `topicHub-{slug}`.
5. Render hubs at `/topics/{slug}` with FAQ schema and contextual internal links.

Configured hubs: Bitcoin, Ethereum, Crypto ETFs, SEC Crypto Regulation, Federal Reserve Policy, Stablecoins, XRP, Solana.

## AI Personas

### Elena Voss — Macro Bear
- Sources: FRED API (`FRED_API_KEY`), SEC EDGAR, CoinGecko
- Trigger: FOMC/CPI/PCE calendar + FRED anomalies
- Unique memory: `forecast` (What to Watch → verified 72h later), `position` (macro stance)
- Schedule: 08:00 UTC

### Marcus Webb — On-Chain Analyst
- Sources: CoinGecko, CoinGlass (`COINGLASS_API_KEY`), mempool.space, blockchain.info
- Trigger: z-score ≥ 1.8 from 30-day baseline on any metric
- Unique memory: `baseline` (rolling 30-day metric averages), `forecast`
- Schedule: 07:00 UTC + 13:00 UTC second chance

### Leo Cruz — Narrative Hunter
- Sources: CoinGecko trending, Fear & Greed, CryptoPanic (`CRYPTOPANIC_API_KEY`), Reddit (public JSON), DexScreener
- Trigger: social signals — new trending, sentiment shift, rotation, fading narrative
- Unique memory: `narrative` (cycle tracker: emerging→growing→peak→fading)
- Schedule: 10:00 UTC

### Victor Kane — Chief Editor
- Does NOT publish articles — internal only
- Reads articles from Sanity + context from Supabase
- Detects overlap via embeddings, evaluates each analyst in parallel
- Writes `editor_feedback` to each analyst's `persona_memory`
- Owns: `session`, `directive_history`, `editorial_standard` memory types
- Schedule: 21:00 UTC

## Supabase Tables

### Existing
- `rss_sources` — RSS feed configuration
- `processed_urls` — deduplication index
- `run_logs` — pipeline run history
- `article_queue` — scored items pending generation
- `subscribers` — email list with DOI
- `email_campaigns` — AI-drafted email drafts
- `email_logs` — outbound email log

### Persona System (migrations 009–016)
- `personas` — persona configs (system_prompt, eval_prompt, config, is_active)
- `persona_memory` — unified memory store (article, forecast, position, context, narrative, baseline, editor_feedback, session, directive_history, editorial_standard)
- `persona_runs` — daily run log per persona

### Editorial Desk (migration 016)
- `editorial_sessions` — one row per day Victor Kane ran
- `editorial_feedback` — per-analyst feedback per session
- `editorial_directives` — directive lifecycle (pending/resolved/missed)

## Admin

Admin UI at `/flows` — 4 pages:

### Dashboard (`/flows`)
Sub-tabs: Overview · Queue · Run Logs · Analytics
- Overview: stats (published today, queue, Elena's stance, last run), pipeline status, recent runs, queue preview
- Analytics: separate API endpoint, 30-day window, generate vs collect split, persona stats, top sources

### Editorial (`/flows/editorial`)
Sub-tabs: Personas · Content Plan · Editorial Desk

**Personas** — PersonaCard per analyst + Victor Kane card:
- Pipeline steps: Pull Data → Evaluate → Dry Generate → Self-Work → ▶ Full Run
- Memory inspector: 5-layer context including Victor Kane's last directive
- Victor Kane card: Run Feedback + session log with scores + directive tracker

**Content Plan** — topic hub management, AI discovery

**Editorial Desk** — Victor Kane's scorecard UI:
- Score cards per analyst (today's score, delta, 14d avg)
- SVG line chart (7/14/30d, gaps for quiet days)
- Feedback cards (Strengths / Priority Fix / Directive / Pattern Warning)
- Desk note with timestamp
- Directive tracker (Pending/Resolved/Missed)
- Session log (accordion, full JSON)

### Email (`/flows/email`)
Sub-tabs: Campaigns · Subscribers & Logs

### Settings (`/flows/settings`)
Sub-tabs: Sources · Pipeline · Integrations

## SEO Features

Implemented:
- `NewsArticle`, `BreadcrumbList`, `Speakable`, `WebSite`, `Organization`, `CollectionPage`, `FAQPage` JSON-LD
- Persona byline on articles (avatar + name)
- Canonical URLs, Open Graph, Twitter metadata
- Google News sitemap
- Category archive pagination
- Topic hub pages with FAQ schema and internal links
- Article disclaimers for YMYL
- `/about` and `/editorial-policy`
- Middleware block for WordPress/PHP probe paths

Still useful to improve:
- Named author/person schema (Person type for each AI persona)
- Dynamic article OG images
- Google Search Console and Google News Publisher Center setup
- Stronger analytics and monthly content audit loop

## Sanity Studio

```text
C:\GameDev\FinCNewsStudio
```

Registered schemas: `article`, `topicHub`

Article schema includes persona fields: `persona`, `authorName`, `authorAvatar`

Deploy Studio:
```bash
npx sanity deploy --url fincnews.sanity.studio --yes --schema-required
```

## Environment Variables

```env
# Site
NEXT_PUBLIC_BASE_URL=https://finc.news
NEXT_PUBLIC_SANITY_PROJECT_ID=x55aaanw
NEXT_PUBLIC_SANITY_DATASET=production

# Sanity
SANITY_PROJECT_ID=x55aaanw
SANITY_DATASET=production
SANITY_TOKEN=...

# AI
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...        # embeddings (text-embedding-3-small, 1536d)

# Data sources — AI personas
FRED_API_KEY=...          # Elena Voss — macroeconomic data
COINGLASS_API_KEY=...     # Marcus Webb — exchange flows
CRYPTOPANIC_API_KEY=...   # Leo Cruz — news sentiment (optional, graceful skip)

# Infrastructure
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Auth
ADMIN_KEY=...
CRON_SECRET=...
N8N_SECRET=...

# Distribution
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHANNEL_ID=@FinCNews
TELEGRAPH_TOKEN=...
PEXELS_API_KEY=...

# Email
RESEND_API_KEY=...        # or similar
```

Keep all server tokens server-only. Do not prefix secrets with `NEXT_PUBLIC_`.

## Local Development

```bash
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:3000`

Useful checks:
```bash
npm run lint
npm run build
```

## Operational Notes

- `SANITY_TOKEN` must have write access for article and topic hub publishing.
- Topic hub IDs must use public root IDs like `topicHub-bitcoin`, not `topicHub.bitcoin`.
- `N8N_SECRET` and `CRON_SECRET` should be ASCII-safe for HTTP headers.
- Telegraph content should stay unique and shorter than site articles.
- The site does not link back to Telegraph pages.
- WordPress probe paths are blocked in middleware with fast 404 responses.
- Persona `is_active` is NOT reset by re-running `seed_personas.sql` — activation is manual via SQL.
- Victor Kane's directives must be behavioral constraints (e.g. "Open with the anomaly value"). Gatekeeping mechanics ("do not publish until approved") are banned — agents run autonomously.
- pgvector IVFFlat index in `persona_memory` is commented out — uncomment after 100+ rows with embeddings.
