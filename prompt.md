# FinCNews — Content Factory Master Spec

## Current Stack
- **Frontend**: Next.js 14 (App Router) → deployed on **Vercel** at `fin-c-news.vercel.app`
- **CMS**: Sanity (project `x55aaanw`, dataset `production`) → Studio at `fincnews.sanity.studio`
- **Automation**: n8n + Claude API + Telegram Bot
- **Language**: English only
- **Niche**: Finance (crypto, markets, macro, fintech, policy, corporate)

---

## Architecture

```
[RSS Sources] → [n8n: Monitor 15min] → [n8n: Deduplicate]
                                               ↓
                                   [n8n: Fetch full article text]
                                               ↓
                                   [n8n: Claude API — generate article JSON]
                                               ↓
                              ┌────────────────┼─────────────────┐
                              ↓                ↓                 ↓
                     [POST /api/publish]  [Pexels image]  [Telegram post]
                              ↓
                       [Sanity CMS]
                              ↓
                    [Next.js ISR — 60s revalidate]
                              ↓
                    [Google Indexing API — submit URL]
```

---

## Route Structure

```
/                          → homepage (hero + market bar + trending + grid)
/[category]                → category page (crypto, markets, economy, fintech, policy, companies)
/[category]/[slug]         → article page
/terms-and-conditions      → legal
/privacy-policy            → legal
/api/publish               → POST endpoint for n8n (Bearer auth)
/api/feed                  → RSS feed
/sitemap.xml               → auto-generated
/robots.txt                → auto-generated
/opengraph-image           → default OG image (Edge runtime)
/studio                    → REMOVED — use fincnews.sanity.studio instead
```

---

## Categories

| Slug | Label | Trigger Keywords |
|------|-------|-----------------|
| `crypto` | Crypto | bitcoin, ethereum, solana, ETF, hack, exploit, fork, airdrop, listing, DeFi, NFT |
| `markets` | Markets | S&P, nasdaq, dow, gold, oil, futures, earnings, IPO, index |
| `economy` | Economy | Fed, rate, CPI, GDP, inflation, recession, FOMC, Powell, ECB |
| `fintech` | Fintech | payment, neobank, stablecoin, CBDC, banking, stripe, revolut |
| `policy` | Policy | SEC, regulation, ban, law, congress, CFTC, MiCA, compliance |
| `companies` | Companies | earnings, revenue, acquisition, merger, layoffs, IPO, quarterly |

---

## /api/publish Payload

```json
{
  "slug": "kebab-case-slug-max-60-chars",
  "category": "crypto",
  "tags": ["bitcoin", "etf", "institutional"],
  "sourceUrl": "https://coindesk.com/...",
  "translations": {
    "en": {
      "title": "SEO title 50-60 chars with primary keyword",
      "excerpt": "2-3 sentence summary with primary keyword",
      "body": "Full article text. Paragraphs separated by \\n\\n",
      "metaTitle": "Meta title 50-60 chars",
      "metaDescription": "Meta description 150-160 chars with CTA",
      "telegramText": "Telegram post text (Post 1 ||| Post 2 ||| Post 3)"
    }
  }
}
```

**Auth**: `Authorization: Bearer fincnews_secret_2026`
**Endpoint (prod)**: `https://fin-c-news.vercel.app/api/publish`
**Validation**: only `translations.en` is required (title + excerpt + body)

---

## n8n Workflows

### Workflow 1 — RSS Monitor (Cron: every 15 min)

1. **Cron** — trigger every 15 min
2. **RSS Feed nodes** (run in parallel):
   - `https://www.coindesk.com/arc/outboundfeeds/rss/`
   - `https://cointelegraph.com/rss`
   - `https://theblock.co/rss.xml`
   - `https://decrypt.co/feed`
   - `https://beincrypto.com/feed/`
   - `https://www.newsbtc.com/feed/`
   - `https://bitcoinmagazine.com/feed`
   - `https://cryptoslate.com/feed/`
3. **Merge** — combine all items
4. **Code (JS)** — filter `pubDate < 2h ago`, deduplicate by URL via n8n static store
5. **Filter** — keep if title/description matches:
   ```
   hack|exploit|ETF|regulation|ban|launch|listing|rate|fed|SEC|crash|bankruptcy|fork|upgrade|airdrop|merger|earnings|IPO|stablecoin|CBDC
   ```
6. **HTTP Request** → trigger Workflow 2 webhook

### Workflow 2 — Content Generator (Webhook)

**Input**: `{ title, description, url, pubDate, source }`

1. **Webhook** — receive trigger
2. **HTTP Request** — `GET {url}` → extract `<article>` body text via Code node (cheerio or regex)
3. **HTTP Request** — Claude API (see prompt below)
4. **Code (JS)** — parse Claude JSON → validate → build `/api/publish` payload
5. **HTTP Request** — `POST https://fin-c-news.vercel.app/api/publish`
6. **HTTP Request** — Pexels API → fetch cover image → upload to Sanity → patch article
7. **IF success** → trigger Workflow 3 (Telegram) + Workflow 4 (Google Index)

### Workflow 3 — Telegram Distributor

**Input**: `{ slug, category, en.title, en.telegramText }`

1. **Split telegramText** by `|||` → 3 posts
2. **Send Post 1** immediately (value post)
3. **Wait** 3h
4. **Send Post 2** (expert analysis)
5. **Wait** 6h
6. **Send Post 3** (affiliate offer)

**Message format:**
```
*{title}*

{post text}

👉 https://fin-c-news.vercel.app/{category}/{slug}

#{category} #{tag1} #{tag2}
```

### Workflow 4 — Google Indexer

1. **HTTP Request** → `POST https://indexing.googleapis.com/v3/urlNotifications:publish`
   ```json
   { "url": "https://fin-c-news.vercel.app/{category}/{slug}", "type": "URL_UPDATED" }
   ```
2. Auth: Google Service Account JWT (Bearer)
3. Limit: max 200 URLs/day per quota

---

## Claude API Prompt

**Model**: `claude-sonnet-4-6` (cost) or `claude-opus-4-7` (quality)
**Max tokens**: 4000
**Response**: strict JSON only

```
You are a senior financial journalist with 15 years covering crypto, markets, and macroeconomics. You write for institutional and retail investors. Writing is factual, precise, data-driven, and SEO-optimized.

INPUT:
Title: {title}
Source: {source}
Published: {pubDate}
Article text: {scrapedBody}

TASK: Generate a finance news article as a single valid JSON object:

{
  "slug": "kebab-case-max-60-chars-with-primary-keyword",
  "category": "one of: crypto | markets | economy | fintech | policy | companies",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "sourceUrl": "{url}",
  "translations": {
    "en": {
      "title": "50-60 chars, primary keyword first, no clickbait",
      "metaTitle": "50-60 chars for Google SERP",
      "metaDescription": "150-160 chars, includes CTA like 'Full analysis inside'",
      "excerpt": "2-3 sentences, includes primary keyword naturally, under 300 chars",
      "body": "FULL ARTICLE — see format below",
      "telegramText": "3-POST SEQUENCE — see format below"
    }
  }
}

BODY FORMAT (plain text, paragraphs separated by \n\n, 800-1200 words):
Para 1: What happened — factual, specific numbers, named entities, dates
Para 2: Why it matters — market impact, historical context, comparison
Para 3: Expert analysis — write as "Based on my analysis of [specific data]..." — authoritative first person
Para 4: Three scenarios — Bull case / Base case / Bear case with specific price targets or metrics
Para 5: How to act — actionable takeaway. End with: "This is not financial advice. Always do your own research."

TELEGRAM 3-POST SEQUENCE (telegramText — join with " ||| "):
Post 1 (150-200 words): Plain English recap of the news. End with "[ARTICLE_URL]"
Post 2 (100-150 words): "Here's what this means for your portfolio..." Expert framing. One rhetorical question.
Post 3 (80-100 words): Natural affiliate bridge. "I use [SERVICE] for exactly this situation." End with "[AFFILIATE_URL]"

RULES:
- Only use facts present in the source text
- Mark speculation as "analysts expect" or "could potentially"
- No invented quotes. No ALL CAPS. No emoji in body.
- Include at least 3 specific numbers/dates/names
- slug must be unique and descriptive, max 60 chars
```

---

## Image Pipeline (Pexels)

In Workflow 2, after publishing to Sanity:

```
Pexels API: GET https://api.pexels.com/v1/search?query={keyword}&per_page=1&orientation=landscape
Header: Authorization: {PEXELS_API_KEY}
→ extract photos[0].src.large2x
→ fetch image as Buffer
→ POST to Sanity assets API
→ PATCH article._id with coverImage reference
```

Keywords per category:
- `crypto` → `"bitcoin cryptocurrency blockchain"`
- `markets` → `"stock market trading finance"`
- `economy` → `"federal reserve central bank economy"`
- `fintech` → `"mobile payment technology fintech"`
- `policy` → `"law regulation government finance"`
- `companies` → `"corporate office business earnings"`

---

## Environment Variables

```env
# Vercel / Next.js
NEXT_PUBLIC_BASE_URL=https://fin-c-news.vercel.app
NEXT_PUBLIC_SANITY_PROJECT_ID=x55aaanw
NEXT_PUBLIC_SANITY_DATASET=production

# Sanity (server-side)
SANITY_PROJECT_ID=x55aaanw
SANITY_DATASET=production
SANITY_TOKEN=sk...

# n8n auth
N8N_SECRET=fincnews_secret_2026

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=   # @fincnews or -100xxxxxxx

# Claude API
ANTHROPIC_API_KEY=

# Images
PEXELS_API_KEY=

# Google Indexing (optional)
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

---

## What Is Already Built ✅

### Site (Next.js on Vercel)
- [x] Homepage: PriceTicker (live CoinGecko) + MarketBar (6 crypto) + HeroSection + Trending sidebar
- [x] Category pages: `/crypto`, `/markets`, `/economy`, `/fintech`, `/policy`, `/companies`
- [x] Article pages: breadcrumbs, JSON-LD NewsArticle, reading time, share buttons (Telegram/X/copy), tags, related articles
- [x] Header: sticky, mobile menu (hamburger → dropdown)
- [x] Footer: sections, social links, RSS, legal links
- [x] `/api/publish` — n8n → Sanity write endpoint (Bearer auth)
- [x] `/api/feed` — RSS feed
- [x] `/sitemap.xml` — auto-generated from Sanity articles
- [x] `/robots.txt`
- [x] `/opengraph-image` — default branded OG image (Edge runtime)
- [x] `/terms-and-conditions` — adapted legal page
- [x] `/privacy-policy` — GDPR-compliant with AI disclosure

### CMS
- [x] Sanity project `x55aaanw` connected
- [x] Sanity Studio deployed at `fincnews.sanity.studio`
- [x] Article schema: slug, category, translations.en (title/excerpt/body/metaTitle/metaDescription/telegramText), coverImage, tags, sourceUrl, publishedAt
- [x] 11 test articles published with cover images

---

## What Needs to Be Built 🔲

### n8n Automation
- [ ] Deploy n8n (n8n.cloud or self-hosted Docker)
- [ ] Workflow 1: RSS Monitor + deduplication (15-min cron)
- [ ] Workflow 2: Claude content generator + Pexels image + `/api/publish`
- [ ] Workflow 3: Telegram 3-post funnel with delays
- [ ] Workflow 4: Google Indexing API submission (optional)

### Monetization
- [ ] Create Telegram channel + bot
- [ ] Set affiliate links (Binance, TradingView, OKX, NordVPN)
- [ ] Wire affiliate placeholders in Workflow 3 Post 3
- [ ] Add newsletter signup (Beehiiv embed)

### Analytics
- [ ] Add Plausible or Umami (privacy-first, no cookie banner needed)

---

## Anti-patterns

- Never publish without `sourceUrl` — always cite
- Never post to Telegram before article is live on site (add 5-min delay or check 200 status)
- If Claude returns non-JSON, log the error and skip — do NOT retry blindly
- Do not exceed 200 Google Indexing API requests/day
- `SANITY_TOKEN` is server-side only — never expose via `NEXT_PUBLIC_`
- N8N_SECRET must be ASCII only — Cyrillic or special chars break curl/n8n auth headers
- Pexels requires `Authorization` header (not query param)
