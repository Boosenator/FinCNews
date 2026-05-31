# FinCNews

FinCNews is a Next.js content automation app for finance and crypto news. It collects RSS items, scores and queues stories, generates factual news articles with Claude, publishes to Sanity, creates Telegraph distribution pages, sends Telegram posts, and maintains evergreen topic hubs for SEO.

Production site: `https://finc.news`

## Stack

- Frontend: Next.js 14 App Router on Vercel
- CMS: Sanity project `x55aaanw`, dataset `production`
- Studio: `fincnews.sanity.studio`
- Queue/logs: Supabase
- Generation: Anthropic Claude Haiku
- Images: Pexels -> Sanity assets
- Distribution: Telegraph + Telegram `@FinCNews`

## Core Routes

- `/` - homepage with latest articles, categories, and topic hubs
- `/[category]` - category archive
- `/[category]/page/[page]` - paginated category archive
- `/[category]/[slug]` - article page
- `/topics` - topic hub index
- `/topics/[slug]` - evergreen topic hub
- `/flows` - admin panel, protected by `ADMIN_KEY`
- `/sitemap.xml` - full sitemap including articles, categories, archive pages, and topic hubs
- `/news-sitemap.xml` - Google News sitemap for recent articles
- `/robots.txt` - crawl rules

## Automation

Vercel cron schedules:

- `/api/cron/collect` every 30 minutes
- `/api/cron/generate` hourly
- `/api/cron/editorial/morning` at `03:00 UTC` / currently `06:00 Kyiv`
- `/api/cron/editorial/evening` at `14:00 UTC` / currently `17:00 Kyiv`
- `/api/cron/editorial/discovery` at `02:30 UTC` / currently `05:30 Kyiv`

News pipeline:

1. Fetch enabled RSS sources from Supabase.
2. Filter by recency and finance/crypto keywords.
3. Deduplicate by URL and title similarity.
4. Score stories for news value.
5. Queue one item for generation.
6. Fetch source article text when possible.
7. Generate a structured news article with Claude.
8. Publish to Sanity through `/api/publish`.
9. Attach a Pexels cover image.
10. Create a unique Telegraph page linking back to the article.
11. Send a Telegram post.
12. Mark queue item as done and store processed URL.

Topic hub pipeline:

1. Run Topic Discovery Agent at 05:30 Kyiv to suggest new evergreen hub candidates from the last 72 hours.
2. Let admins approve, dismiss, or approve-and-create suggested topics from Content Plan.
3. Rank approved topic plans by recent FinCNews coverage.
4. Pick the hottest two topics once per Kyiv day.
5. Refresh one hub in the morning and one in the evening.
6. Use Anthropic tool output to avoid broken JSON.
7. Store public Sanity documents as `topicHub-{slug}`.
8. Render hubs at `/topics/{slug}` with FAQ schema and contextual internal links.

Configured topic hubs include Bitcoin, Ethereum, Crypto ETFs, SEC Crypto Regulation, Federal Reserve Policy, Stablecoins, XRP, and Solana.

## Admin

Admin UI lives at `/flows`.

Main tabs include:

- queue and source controls
- manual collect/generate actions
- logs
- analytics
- Telegraph stats
- Content Plan for topic hubs

The Content Plan tab shows planned/published/private topic hubs, related article counts, refresh actions, and public URLs. Legacy Sanity IDs with dots, such as `topicHub.bitcoin`, are treated as private because Sanity does not expose them publicly without a token.

It also shows Suggested Topics discovered by the Topic Discovery Agent. Admins can run discovery manually, approve a suggestion into the dynamic topic plan, create a hub immediately, or dismiss the suggestion.

## SEO Features

Implemented:

- `NewsArticle`, `BreadcrumbList`, `Speakable`, `WebSite`, `Organization`, `CollectionPage`, and `FAQPage` JSON-LD where appropriate
- canonical URLs
- Open Graph and Twitter metadata
- Google News sitemap
- category archive pagination
- topic hub pages
- internal related article matching for topic hubs
- article disclaimers for YMYL
- `/about` and `/editorial-policy`
- middleware block for common WordPress/PHP probe paths

Still useful to improve:

- named author/person schema
- dynamic article OG images
- Google Search Console and Google News Publisher Center setup
- stronger analytics and monthly content audit loop

## Sanity Studio

The app can write arbitrary documents through the Sanity API, but Studio must also register schemas to make document types visible in the Studio UI.

The Studio project is in:

```text
C:\GameDev\FinCNewsStudio
```

It registers:

- `article`
- `topicHub`

Deploy Studio with:

```bash
npx sanity deploy --url fincnews.sanity.studio --yes --schema-required
```

## Environment Variables

Required production variables:

```env
NEXT_PUBLIC_BASE_URL=https://finc.news
NEXT_PUBLIC_SANITY_PROJECT_ID=x55aaanw
NEXT_PUBLIC_SANITY_DATASET=production

SANITY_PROJECT_ID=x55aaanw
SANITY_DATASET=production
SANITY_TOKEN=...

ANTHROPIC_API_KEY=...
PEXELS_API_KEY=...

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

ADMIN_KEY=...
CRON_SECRET=...
N8N_SECRET=...

TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHANNEL_ID=@FinCNews
TELEGRAPH_TOKEN=...
```

Keep server tokens server-only. Do not prefix secrets with `NEXT_PUBLIC_`.

## Local Development

```bash
npm install --legacy-peer-deps
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful checks:

```bash
npm run lint
npm run build
```

Production preview after build:

```bash
npm run start
```

## Operational Notes

- `SANITY_TOKEN` must have write access for article and topic hub publishing.
- Topic hub IDs must use public root IDs like `topicHub-bitcoin`, not dotted IDs like `topicHub.bitcoin`.
- `N8N_SECRET` and `CRON_SECRET` should be ASCII-safe for HTTP headers.
- Telegraph content should stay unique and shorter than site articles.
- The site should not link back to Telegraph pages.
- WordPress probe paths such as `/wp-admin/install.php` are blocked in middleware with fast 404 responses.
