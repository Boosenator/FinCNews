# FinCNews — Content Factory Master Spec

## Current Stack
- **Frontend**: Next.js 14 (App Router) → Vercel `finc.news`
- **CMS**: Sanity project `x55aaanw`, dataset `production` → Studio `fincnews.sanity.studio`
- **Automation**: Vercel Cron + Claude Haiku API + Supabase
- **Distribution**: Telegram `@FinCNews` → Telegra.ph → Site
- **Language**: English only
- **Niche**: Finance (crypto, markets, macro, fintech, policy, companies)

---

## Traffic Flow (SEO Link Graph)

```
Vercel Cron (every 5min) → Collect RSS → article_queue (Supabase)
Vercel Cron (every 10min) → Generate → Claude Haiku → Sanity
                                      → Pexels image → Sanity
                                      → Telegraph page (DR90+ backlink)
                                      → Telegram post (photo + Telegraph URL)

Traffic funnel:
Telegram → Telegraph (instant view) → Site article
                 ↑ backlink to site       ↑ destination
```

---

## Route Structure

```
/                          → homepage (WebSite + Organization schema)
/[category]                → category page (BreadcrumbList schema)
/[category]/[slug]         → article (NewsArticle + BreadcrumbList + Speakable)
/terms-and-conditions      → legal
/privacy-policy            → legal
/about                     → E-E-A-T (TODO)
/flows                     → admin panel (auth: ADMIN_KEY cookie)
/api/publish               → POST — n8n/automation → Sanity
/api/feed                  → RSS feed
/api/cron/collect          → Vercel Cron 5min — RSS → Supabase queue
/api/cron/generate         → Vercel Cron 10min — queue → Claude → Sanity → TG
/api/admin/collect         → manual trigger (admin)
/api/admin/generate        → manual trigger (admin)
/api/admin/run             → full run (admin)
/api/admin/attach-images   → attach Pexels images to articles without photo
/api/admin/test-telegram   → send test message to @FinCNews
/sitemap.xml               → auto-generated
/news-sitemap.xml          → Google News sitemap (last 48h articles)
/robots.txt                → blocks /api/ /flows /studio/
/opengraph-image           → default OG image (edge runtime)
```

---

## Categories

| Slug | Label | Trigger Keywords |
|------|-------|-----------------|
| `crypto` | Crypto | bitcoin, ethereum, ETF, hack, exploit, DeFi, NFT, staking, airdrop |
| `markets` | Markets | stock, S&P, nasdaq, gold, oil, futures, earnings, IPO, rally, crash |
| `economy` | Economy | Fed, Federal Reserve, rate, CPI, inflation, GDP, recession, FOMC |
| `fintech` | Fintech | payment, neobank, stablecoin, CBDC, stripe, revolut, fintech |
| `policy` | Policy | SEC, CFTC, MiCA, regulation, ban, congress, compliance, sanctions |
| `companies` | Companies | earnings, revenue, merger, acquisition, IPO, layoffs, bankruptcy |

---

## /api/publish Payload

```json
{
  "slug": "kebab-max-60-chars",
  "category": "crypto",
  "tags": ["bitcoin", "etf"],
  "sourceUrl": "https://coindesk.com/...",
  "translations": {
    "en": {
      "title": "SEO title 50-60 chars",
      "excerpt": "2-3 sentences, primary keyword, under 250 chars",
      "body": "400-600 word article: facts → why matters → expert take → action. End: Not financial advice.",
      "metaTitle": "50-60 chars",
      "metaDescription": "150-160 chars with CTA",
      "telegramText": "used internally by old flow — ignored now"
    }
  }
}
```

**Auth**: `Authorization: Bearer fincnews_secret_2026`
**Endpoint (prod)**: `https://finc.news/api/publish`

---

## Automation Pipeline (current)

### Collect Cron (every 5 min, maxDuration 30s)

1. Fetch all enabled `rss_sources` from Supabase in **parallel**
2. Parse RSS/Atom feeds (custom XML parser, no dependencies)
3. Filter: `pubDate < 48h` + keyword match (word boundary for short words)
4. URL dedup: check `processed_urls` + `article_queue` in Supabase
5. Semantic dedup: Jaccard similarity > 0.5 against last 48h titles → skip
6. `upsert` new items into `article_queue` (ignoreDuplicates: conflict-safe)

### Generate Cron (every 10 min, maxDuration 120s)

Current generation includes a pre-Claude uniqueness step: fetch the latest 20 same-category Sanity titles from the last 14 days and pass them to Claude as an avoid list. Claude runs with `max_tokens: 1800` so it has enough room for the avoid list plus the article JSON.

1. Reset stuck `processing` items > 10min → back to `pending`
2. Fetch 1 `pending` item from `article_queue`
3. `tryFetchArticleText` (Googlebot UA, 8s timeout) → fall back to RSS snippet
4. Fetch recent same-category Sanity titles from the last 14 days and pass them to Claude as an avoid list
5. **Claude Haiku** (`claude-haiku-4-5-20251001`, max_tokens 1800, 55s timeout)
6. `publishToSanity` via `/api/publish`
7. `attachPexelsImage` → Pexels search by category → upload to Sanity → patch article
8. `createTelegraphPage` → short unique content + backlink to site → get `telegra.ph` URL
9. Patch Sanity article with `telegraphUrl`
10. Mark `article_queue` → `done`, insert into `processed_urls`
11. `sendTelegram` → `sendPhoto` with Telegraph URL (single CTA)

---

## Claude Prompt (Haiku, compressed)

```
Financial journalist. Output ONLY raw JSON, no markdown.

Title: {title}
Date: {date} | Category: {category}
Text: {body.slice(0, 1500)}

Recently published FinCNews titles to avoid:
1. {category}/{slug} - {recent title}
2. ...

Uniqueness requirements:
- Do not reuse the same headline frame, slug phrase, or broad angle from the avoid list.
- If the source overlaps with an avoid-list story, make the new article narrower: lead with the new entity, number, timeline, legal action, market reaction, or consequence.
- The title, metaTitle, excerpt, and slug must include the differentiator that makes this article distinct.
- Avoid generic repeats like "Bitcoin drops", "XRP rally", "SEC crypto case", or "Iran crypto seizure" unless the new fact is explicit.

JSON: {"slug":"kebab-max-60","category":"{category}","tags":["t1","t2","t3"],
"translations":{"en":{"title":"SEO 50-60 chars","excerpt":"2-3 sentences under 250 chars",
"body":"600-800 word article: What happened → Why matters → Expert take (first person) → What to watch. End: Not financial advice.",
"metaTitle":"50-60","metaDescription":"150-160 with CTA","telegramText":"ignored"}}}

Rules: facts only, real numbers/dates, slug <= 60 chars.
```

**Cost**: ~$0.009/article (Haiku vs $0.035 Sonnet — 75% saving)

---

## Telegram Post Format

```
₿ CRYPTO  (or 🚨 BREAKING for breaking news)

[bold title — punchy, provocative angle]

[1-2 sentences, specific numbers]

What this means 👇  (or varied CTA by category)
telegra.ph/article-url

#bitcoin #crypto #FinCNews
```

**Rules:**
- `sendPhoto` when Pexels image available (higher engagement)
- `sendMessage` with `prefer_large_media: true` as fallback
- ONE link only — Telegraph URL (instant view in TG)
- Breaking detection: title keywords → `🚨 BREAKING` header
- CTA rotates by category: "Full breakdown →", "Numbers inside →", "What changes →"
- Max 3 hashtags

---

## Telegraph Integration

**Purpose**: DR90+ backlink from `telegra.ph` to site. Google treats this as strong authority signal.

**Content**: unique shortened version (excerpt + 2-3 body sentences) + link to site.
**NOT** a copy of the article — unique content requirement.

**Link graph**:
```
Telegram → Telegraph (instant view) → Site
                   ↑ backlink to site article
```

Site does NOT link to Telegraph (would bounce users + duplicate content signal).

---

## SEO Implementation (Phase 1 Done)

### Structured Data
- ✅ `NewsArticle` on every article (headline, datePublished, author Org, publisher, ImageObject)
- ✅ `BreadcrumbList` on article + category pages
- ✅ `Speakable` on article pages (`.article-excerpt` selector)
- ✅ `WebSite` + SearchAction on homepage
- ✅ `Organization` on homepage (logo, sameAs: Telegram + X)

### Meta
- ✅ Homepage: title + description metadata + H1 (sr-only)
- ✅ Category pages: unique OG + Twitter + canonical + BreadcrumbList
- ✅ Article pages: full OG (ImageObject), Twitter card, canonical, alternates
- ✅ `news-sitemap.xml` (last 48h, Google News format)
- ✅ `robots.txt` blocks /api/ /flows /studio/
- ✅ `app/icon.jpg` → favicon
- ✅ `app/opengraph-image.tsx` → default OG (edge runtime)

### SEO TODO (Phase 2)
- [ ] `/about` page — E-E-A-T signal (YMYL critical)
- [ ] `/editorial-policy` — Google quality rater requirement
- [ ] Author `Person` schema on articles
- [ ] Internal linking in Claude prompt (`[INTERNAL: topic]` → resolve)
- [ ] Google Search Console — submit both sitemaps
- [ ] Google News Publisher Center — apply for inclusion
- [ ] Plausible analytics install
- [ ] 5 pillar evergreen articles (manual, topic clusters)
- [ ] `/about` page with author entity

---

## Environment Variables

```env
# Vercel / Next.js
NEXT_PUBLIC_BASE_URL=https://finc.news
NEXT_PUBLIC_SANITY_PROJECT_ID=x55aaanw
NEXT_PUBLIC_SANITY_DATASET=production

# Sanity (server)
SANITY_PROJECT_ID=x55aaanw
SANITY_DATASET=production
SANITY_TOKEN=sk...

# Automation auth
N8N_SECRET=fincnews_secret_2026
ADMIN_KEY=...         (admin panel /flows)
CRON_SECRET=...       (Vercel Cron auth)

# Claude
ANTHROPIC_API_KEY=sk-ant-...

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHANNEL_ID=@FinCNews

# Images
PEXELS_API_KEY=...

# Telegraph
TELEGRAPH_TOKEN=...   (from api.telegra.ph/createAccount)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Supabase Schema

```sql
-- RSS sources
rss_sources: id, name, url, category, enabled, last_fetched_at, articles_published

-- Queue (collect → generate pipeline)
article_queue: id, url, title, snippet, source_category, source_name, pub_date,
               queued_at, status (pending/processing/done/error), processed_at, error_text

-- Deduplication
processed_urls: id, url, slug, title, category, published_at

-- Automation logs
run_logs: id, started_at, finished_at, status, articles_found, articles_published,
          articles_skipped, duration_ms, error_text, details (jsonb)
```

---

## Admin Panel (/flows)

| Button | Action |
|--------|--------|
| 📷 Attach Images | Find articles without coverImage → Pexels → Sanity |
| Collect RSS | Manual RSS fetch → article_queue |
| Generate Articles | 1 article from queue → Claude → Sanity → Telegraph → Telegram |
| ▶ Full Run | collect + generate combined |
| Test (per source) | Fetch that RSS, show items + keyword matches |
| Send test message | Test @FinCNews bot connection |

Auto-refresh: 20s. Stale RUNNING logs > 5min → auto-marked error.

---

## Anti-patterns

- `N8N_SECRET` and `CRON_SECRET` must be **ASCII only** — Cyrillic breaks curl/headers
- `SANITY_TOKEN` server-side only — never `NEXT_PUBLIC_`
- Do NOT link Site → Telegraph (bounces users, duplicate content)
- Telegraph content must be **unique** (not copy-paste of article) — different length, focus
- Keyword word-boundary matching for short words (≤5 chars) prevents "ban" → "bank" false positives
- `upsert` with `ignoreDuplicates` in collect — never `insert` (race condition)
- `attachPexelsImage` is `await` (not `void`) — image must exist before Telegram post
- Max 200 Google Indexing API requests/day (if using)
