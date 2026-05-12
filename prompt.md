# Content Factory — Master Prompt & System Specification

## Role
You are a senior full-stack developer building a **production-ready, automated finance news content factory**.
Stack: Next.js 14 + Sanity CMS + n8n + Claude API + Telegram Bot API.
Niche: **Finance** (crypto, macro, markets, fintech, regulation).
Primary language: **English**. Site also supports ua/ru/pl via existing i18n.

---

## System Architecture

```
[News Sources] → [n8n: Monitor] → [n8n: Filter & Deduplicate]
                                          ↓
                              [n8n: Claude API — Generate Cluster]
                                          ↓
                    ┌─────────────────────┼──────────────────────┐
                    ↓                     ↓                      ↓
             [POST /api/publish]   [Telegram Bot]    [Google Indexing API]
                    ↓
             [Sanity CMS]
                    ↓
             [Next.js Site — SEO]
```

### Key constraint
`/api/publish` already exists and validates:
- `slug`, `category` (must be in allowed list), `translations` with `title/excerpt/body` for all locales.
- Allowed categories: `tech | finance | crypto | world | ukraine | lifestyle | sport | auto | health`
- Locales: `en | ua | ru | pl`

---

## n8n Workflows

### Workflow 1 — News Monitor (trigger: every 15 min)

**Nodes:**
1. **Cron** — every 15 minutes
2. **RSS Feed** (parallel, one node per source):
   - `https://www.coindesk.com/arc/outboundfeeds/rss/`
   - `https://cointelegraph.com/rss`
   - `https://theblock.co/rss.xml`
   - `https://decrypt.co/feed`
   - `https://beincrypto.com/feed/`
   - `https://www.newsbtc.com/feed/`
   - `https://bitcoinmagazine.com/feed`
3. **Merge** — combine all RSS items
4. **Code (JS)** — filter by recency (< 2h old), deduplicate by URL using n8n static data store
5. **Filter** — keep items where title/description contains trigger keywords:
   ```
   hack|exploit|partnership|regulation|ban|launch|listing|ETF|rate|fed|SEC|crash|pump|bankruptcy|merge|fork|upgrade|airdrop|settlement
   ```
6. **HTTP Request** → Workflow 2 (via n8n webhook)

### Workflow 2 — Content Generator (trigger: webhook from Workflow 1)

**Input:** `{ title, description, url, pubDate, source }`

**Nodes:**
1. **Webhook** — receive article seed
2. **HTTP Request: Fetch Source** — GET source URL, extract body text (use cheerio via Code node)
3. **HTTP Request: Claude API** — generate full content cluster (see Claude Prompts section)
4. **Code (JS)** — parse Claude JSON response, build `/api/publish` payload
5. **HTTP Request: POST /api/publish** — publish to Sanity
6. **IF** — on success → Workflow 3 (Telegram) + Workflow 4 (Indexer)

### Workflow 3 — Telegram Distributor

**Input:** `{ slug, category, translations.en }`

**Nodes:**
1. **Wait** — 5 minutes after publish (Google needs to crawl first)
2. **Telegram: Send Post 1** — value post (use `translations.en.telegramText` field, part 1)
3. **Wait** — 3 hours
4. **Telegram: Send Post 2** — expert take ("how to profit/protect from this")
5. **Wait** — 6 hours
6. **Telegram: Send Post 3** — affiliate offer (append partner link)

**Telegram message format:**
```
📌 *{headline}*

{2-3 sentence summary}

👉 Full analysis: https://fincnews.com/{locale}/{category}/{slug}

#finance #{category} #{tag1} #{tag2}
```

### Workflow 4 — Google Indexer

**Nodes:**
1. **HTTP Request** — POST to Google Indexing API
   - URL: `https://indexing.googleapis.com/v3/urlNotifications:publish`
   - Body: `{ "url": "https://fincnews.com/en/{category}/{slug}", "type": "URL_UPDATED" }`
   - Auth: Google Service Account JWT
2. **Repeat** for each locale: en, ua, ru, pl

---

## Claude API Prompts

### Master Prompt — Full Cluster Generation

Use model: `claude-opus-4-7` (or `claude-sonnet-4-6` for cost savings).
Response must be **valid JSON** — use `max_tokens: 8000`.

```
You are a senior financial journalist with 15 years of experience covering global markets, crypto, and fintech. You write for institutional and retail investors. Your writing is factual, precise, and SEO-optimized.

INPUT NEWS:
Title: {title}
Source: {source}
Published: {pubDate}
Original text: {scrapedBody}

TASK:
Analyze the above news and generate a full content cluster as a JSON object with this exact structure:

{
  "slug": "kebab-case-url-slug-max-60-chars",
  "category": "one of: finance | crypto | tech",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "sourceUrl": "{original_url}",
  "translations": {
    "en": {
      "title": "SEO title, 50-60 chars, contains primary keyword",
      "metaTitle": "Meta title 50-60 chars",
      "metaDescription": "Meta description 150-160 chars with CTA",
      "excerpt": "2-3 sentence summary, contains primary keyword naturally",
      "body": "FULL HUB ARTICLE — see format below",
      "telegramText": "TELEGRAM 3-POST SEQUENCE — see format below"
    },
    "ua": { same structure, translated to Ukrainian },
    "ru": { same structure, translated to Russian },
    "pl": { same structure, translated to Polish }
  }
}

HUB ARTICLE FORMAT (body field, 1500+ words, plain text with \n\n between paragraphs):
- H2: What Happened (factual recap from 2-3 angles)
- H2: Why This Matters for Investors (market impact, historical context)
- H2: Expert Analysis (write as "Based on my analysis of the on-chain data..." — first person, authoritative)
- H2: What Could Happen Next (3 scenarios: bull / base / bear)
- H2: How to Position (actionable advice, NOT financial advice disclaimer at end)
- Add naturally: 3-4 LSI keywords, 1-2 internal link placeholders as [INTERNAL: related topic], 1 external authority link to primary source

TELEGRAM 3-POST SEQUENCE (telegramText field, all 3 posts separated by "|||"):
Post 1 (Value): 150-200 words. Explain the news plainly. End with article link placeholder [ARTICLE_URL].
Post 2 (Expert take): 100-150 words. "Here's what this means for your portfolio" framing. 1 rhetorical question.
Post 3 (Offer): 80-100 words. Natural affiliate bridge — "I use [SERVICE] to track/trade/protect against exactly this kind of event." End with [AFFILIATE_URL] placeholder.

QUALITY RULES:
- Verify: only include facts present in the source text. Mark speculation clearly as "analysts expect" or "could potentially".
- No clickbait. No ALL CAPS. No invented quotes.
- Google E-E-A-T: include specific numbers, dates, named entities.
- Each translation must be culturally adapted, not word-for-word translation.
```

### Quick Satellite Prompt (for Reddit/Quora posts)

```
You are a finance expert answering a specific question on Reddit r/investing or r/CryptoCurrency.

NEWS CONTEXT: {excerpt from hub article}
MICRO-QUERY: {specific question, e.g. "Is my {exchange} funds safe after this hack?"}

Write a 300-400 word Reddit-style answer:
- Start with direct answer (no fluff)
- Give 2-3 supporting points with data
- End with "I wrote a deeper breakdown here: [ARTICLE_URL]"
- Tone: helpful expert, not promotional
- No markdown headers — use plain paragraphs
```

---

## Environment Variables Required

```env
# Sanity
SANITY_PROJECT_ID=
SANITY_DATASET=production
SANITY_TOKEN=

# Automation
N8N_SECRET=                     # Bearer token for /api/publish auth

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHANNEL_ID=            # e.g. @fincnews or -100xxxxxxxxxx

# Claude API
ANTHROPIC_API_KEY=

# Google Indexing
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=             # JSON escaped

# Affiliate (Finance niche defaults)
AFFILIATE_BINANCE=
AFFILIATE_OKEX=
AFFILIATE_TRADINGVIEW=
AFFILIATE_NORDVPN=
```

---

## Content Strategy — Finance Niche

### Priority Categories
| Category | Trigger Keywords | Affiliate Match |
|----------|-----------------|-----------------|
| `crypto` | hack, exploit, listing, ETF, fork, upgrade | Binance, OKX, Ledger |
| `finance` | Fed, rate, CPI, GDP, earnings, bankruptcy | TradingView, Wise |
| `tech` | AI launch, SaaS funding, acquisition | Semrush, HubSpot |

### Content Cluster Structure per Story
```
HUB (Medium/LinkedIn) ← NOT built yet, future expansion
  ├── Main article on site (/en/crypto/{slug})
  │     └── Internal links to 2 older articles
  ├── Satellite 1: Reddit r/CryptoCurrency — micro-query answer
  ├── Satellite 2: Quora — "What does X mean for Y?"
  └── Telegra.ph — ultra-short briefing (for backlinks)
        ↓ all link back to main article
              ↓
        Telegram Channel (3-post funnel)
              ↓
        Affiliate conversion
```

### Slug Convention
`{primary-keyword}-{year}-{month}` → e.g. `bitcoin-etf-approval-2026-05`

### Publish Cadence
- **Breaking news**: immediately, within 30 min of source
- **Analysis**: 1-2 per day
- **Evergreen**: 3 per week (manually or scheduled n8n)

---

## Implementation Checklist

### Phase 1 — Core Pipeline (Week 1)
- [ ] Deploy n8n (self-hosted via Docker or n8n.cloud)
- [ ] Build Workflow 1: RSS Monitor with deduplication
- [ ] Build Workflow 2: Claude content generator
- [ ] Test `/api/publish` end-to-end with mock payload
- [ ] Configure `.env` with all secrets

### Phase 2 — Distribution (Week 2)
- [ ] Create Telegram bot + channel
- [ ] Build Workflow 3: 3-post Telegram funnel with delays
- [ ] Build Workflow 4: Google Indexing API submission
- [ ] Add `sitemap.xml` generation to Next.js

### Phase 3 — SEO & Quality (Week 3)
- [ ] Add `robots.txt`, canonical tags, OG meta to Next.js pages
- [ ] Implement structured data (Article schema, BreadcrumbList)
- [ ] Add reading time, author entity (even if "FinCNews Editorial Team")
- [ ] Add RSS feed for the site itself (`/feed.xml`)
- [ ] Set up Reddit/Quora satellite posting (manual first, then automate)

### Phase 4 — Monetization (Week 4)
- [ ] Integrate affiliate links into Telegram Post 3 template
- [ ] A/B test Telegram CTA copy
- [ ] Add newsletter capture (Beehiiv or ConvertKit embed)
- [ ] Set up Plausible or Umami (privacy-first analytics)

---

## Code Conventions for This Project

- All API routes live in `app/api/`
- Sanity client: always import from `lib/sanity.ts`
- i18n config (locales, categories): always import from `lib/i18n.ts`
- n8n communicates via `Bearer ${N8N_SECRET}` header
- Body field in Sanity accepts both plain string (n8n sends text) and PortableTextBlock[] — the `/api/publish` route normalizes both
- Never hardcode locale strings — always use `locales` array from `lib/i18n.ts`

---

## Anti-patterns to Avoid

- Do NOT generate content without source URL — always cite
- Do NOT publish if Claude returns non-JSON (add try/catch + n8n error branch)
- Do NOT post to Telegram before article is live on site (use the 5-min delay)
- Do NOT use `dangerouslyAllowBrowser: true` in Sanity client — server-side only
- Do NOT translate with simple word-for-word prompts — instruct Claude to culturally adapt
- Do NOT index more than 200 URLs/day via Google Indexing API (quota limit)
