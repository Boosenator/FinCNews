# FinCNews SEO Master Plan — 2027 Edition

> **Context**: Google 2026-2027 = AI Overviews dominate above the fold, E-E-A-T is existential for YMYL finance sites, structured data feeds Gemini citations directly, Core Web Vitals are ranking factors. Zero-click is 65%+ of searches. Win = be the cited source, not just rank #1.

---

## The 2027 Paradigm Shift

Finance is YMYL (Your Money Your Life) — highest scrutiny tier. Google's quality raters evaluate every signal. One bad E-E-A-T signal can suppress the entire domain. Our moat: **speed + AI-generated volume + entity authority**.

```
2020s SEO: keyword → rank → click
2027 SEO:  entity → authority → citation in AI Overview → brand search → click
```

---

## Phase 1 — Technical Foundation (Week 1) ✅ IN PROGRESS

### 1.1 Structured Data (JSON-LD)

| Schema | Page | Status | Why |
|--------|------|--------|-----|
| `NewsArticle` | Article | ✅ Done | Feeds Google News + AI Overviews |
| `BreadcrumbList` | Article | ❌ Missing | SERP breadcrumbs, entity hierarchy |
| `WebSite` + SearchAction | Root | ❌ Missing | Sitelinks searchbox in SERP |
| `Organization` | Root | ❌ Missing | Entity establishment, Knowledge Panel |
| `Speakable` | Article | ❌ Missing | Voice search + AI summaries use this |
| `FAQPage` | Article (future) | ❌ Missing | Zero-click featured snippets |
| `Person` (author) | Article | ❌ Missing | E-E-A-T signal |

### 1.2 Meta & OG
- ❌ Homepage H1 missing
- ❌ Homepage `metadata` export missing
- ❌ Category pages: no OG/Twitter
- ❌ Dynamic per-article OG image (article slug page)
- ❌ X (Twitter) card `creator` tag

### 1.3 Robots & Crawl
- ❌ `/api/*`, `/flows`, `/studio` not blocked
- ❌ Separate Google News sitemap (`/news-sitemap.xml`)
- ⚠️ Category `lastModified` = always now() (false freshness)

### 1.4 Core Web Vitals (Vercel + Next.js = already strong)
- ✅ ISR 60s revalidation
- ✅ next/image optimization
- ❌ No `loading="lazy"` on below-fold images explicitly
- ❌ No `fetchpriority="high"` on hero image
- ❌ Font preload missing

---

## Phase 2 — Content Architecture (Month 1)

### 2.1 Topic Clusters Strategy
Don't chase single keywords. Own **topic clusters** — one pillar + satellites.

```
Pillar: "Bitcoin ETF" (/crypto/bitcoin-etf-guide)
  ├── Satellite: "BlackRock IBIT inflows 2026"
  ├── Satellite: "Bitcoin ETF vs direct BTC"
  ├── Satellite: "Tax implications Bitcoin ETF"
  └── Satellite: "Best Bitcoin ETFs ranked"
        ↓ all link to pillar
```

Priority clusters for 2027:
1. `Bitcoin ETF` — institutional demand narrative
2. `CLARITY Act` / `Crypto regulation US` — policy content
3. `Federal Reserve + Bitcoin` — macro-crypto correlation
4. `Stablecoin yield` — fintech angle
5. `XRP legal / Ripple` — ongoing high-volume topic

### 2.2 Evergreen Pages (Programmatic SEO)
Auto-generate from Sanity data:
- `/crypto/bitcoin` — Bitcoin hub (price history, all articles, key stats)
- `/crypto/ethereum` — Ethereum hub
- `/markets/sp500` — S&P 500 hub
- `/company/coinbase` — Company hubs (earnings, articles, key metrics)

These pages rank for "what is X" queries and funnel into news articles.

### 2.3 Internal Linking Rules
Implement in automation prompt:
- Every article must link to 2 older articles (`[INTERNAL: topic]` placeholders → resolve in publish pipeline)
- Category pages link to pillar articles
- Footer "Most Read" section (static, manually curated quarterly)

### 2.4 Content Cadence
| Type | Frequency | Source | Goal |
|------|-----------|--------|------|
| Breaking news | As it happens (cron) | RSS → Claude Haiku | Volume, freshness |
| Analysis | 2-3/day (generated) | RSS → Claude Sonnet | Depth, E-E-A-T |
| Evergreen guides | 1/week (manual) | Research | Longtail, clusters |
| Price updates | Daily (programmatic) | CoinGecko | "bitcoin price today" |

---

## Phase 3 — E-E-A-T (Month 1-2)

Google's financial content quality raters look for:

### 3.1 Author Entity
- Create `/about` page: FinCNews Editorial team description, methodology, fact-checking policy
- Create `Person` schema: "FinCNews Editorial" as named entity with credentials
- Add author byline with photo to every article (even if team photo)
- Link author to Twitter/X profile (entity signal)

### 3.2 Editorial Standards Page
Google's quality raters check for: `/about`, `/editorial-policy`, `/corrections`
```
/about — who we are, how we generate content, AI disclosure
/editorial-policy — accuracy standards, source requirements
/advertise — monetization transparency (required for YMYL trust)
```

### 3.3 Financial Disclaimer
Every article and page footer must have:
> "FinCNews content is AI-assisted and for informational purposes only. Not financial advice. Always consult a qualified advisor."

Currently: in T&C only. Needs to be in article JSON-LD and visible on page.

### 3.4 Fact-Checking & Citations
In Claude prompt: require at least 2 named sources per article.
Add `sourceUrl` display prominently (already in code — surface it better).

---

## Phase 4 — Distribution & Off-Page (Month 2-3)

### 4.1 Google News Inclusion
- Submit to Google News Publisher Center
- Requires: `/news-sitemap.xml` with last 2 days of articles
- Requires: Clear bylines, publication dates, original content signal
- Payoff: massive traffic spike potential, "Top Stories" carousel

### 4.2 Google Discover
Discover shows cards to users based on interests, not search queries. Keys:
- High-quality cover images (we have Pexels ✅)
- Engaging titles (not clickbait but compelling)
- Fast page speed (✅)
- E-E-A-T (phase 3)

### 4.3 Telegram as SEO Flywheel
```
Article published → Telegram post → Engagement → Shares → Backlinks
                                              ↓
                              Brand searches ("FinCNews bitcoin")
                                              ↓
                              Google sees branded demand → trust boost
```

### 4.4 Reddit Strategy (2027: Reddit ranks for everything)
Manual posting of satellite content to:
- r/CryptoCurrency (1.5M members)
- r/Bitcoin (7M members)
- r/investing
- r/wallstreetbets (carefully)

Link back to article. Reddit links = nofollow but Google trusts Reddit content as signals.

### 4.5 X (Twitter) Presence
Auto-post article title + link via X API when published.
X links index fast and appear in Google News results.

### 4.6 Backlink Strategy
Target: niche finance aggregators that link to primary sources.
- CryptoPanic.com — submit RSS
- CoinSpectator.com — submit feed
- Feedly curated lists

---

## Phase 5 — Analytics & Monitoring (Ongoing)

### 5.1 Google Search Console
- Submit sitemap: `fin-c-news.vercel.app/sitemap.xml`
- Submit news sitemap: `fin-c-news.vercel.app/news-sitemap.xml`
- Monitor: Core Web Vitals, crawl errors, manual actions
- Track: impressions vs clicks per article (CTR optimization)

### 5.2 Analytics (Privacy-first)
Add Plausible or Umami (no cookie banner needed):
```
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=fin-c-news.vercel.app
```

### 5.3 KPIs to Track
| Metric | Target 3mo | Target 6mo | Target 12mo |
|--------|-----------|-----------|------------|
| Organic sessions/mo | 5K | 25K | 100K |
| Indexed articles | 500 | 2000 | 5000 |
| Google News inclusion | — | ✅ | ✅ |
| Domain Rating (Ahrefs) | 10 | 20 | 35 |
| Avg position (finance KWs) | 45 | 25 | 15 |
| Telegram subscribers | 500 | 2K | 10K |

### 5.4 Content Audit (Monthly)
- Articles with 0 impressions after 30 days → update or redirect
- Articles with high impressions but low CTR → rewrite title/meta
- Category pages with thin content → add curated list intro

---

## What AI Overviews Mean for Us (2027 Reality)

Google's AI Overviews cite sources. Being cited = brand exposure without a click = brand search → direct traffic.

To be cited:
1. **Unique data**: include specific numbers, dates, percentages (already in prompt ✅)
2. **First-person expert angle**: "Based on my analysis of on-chain data..." (already in prompt ✅)
3. **Structured data**: JSON-LD NewsArticle with all fields populated ✅
4. **Speakable schema**: marks which sentences are summary-worthy for AI
5. **E-E-A-T**: Google only cites trusted sources for YMYL

---

## Implementation Checklist

### Technical (can code now)
- [ ] Homepage H1 + metadata
- [ ] Category pages: OG + Twitter metadata
- [ ] WebSite + Organization schema in root layout
- [ ] BreadcrumbList JSON-LD in article pages
- [ ] Speakable JSON-LD in article pages
- [ ] Dynamic OG image per article
- [ ] Google News sitemap `/news-sitemap.xml`
- [ ] Fix robots.txt (block /api, /flows)
- [ ] Fix JSON-LD image → ImageObject format
- [ ] Font preload in layout

### Content (editorial/automation)
- [ ] /about page
- [ ] /editorial-policy page
- [ ] Financial disclaimer on articles
- [ ] Internal linking in Claude prompt
- [ ] 5 pillar evergreen articles (manual)

### Distribution
- [ ] Google News Publisher Center submission
- [ ] Submit RSS to CryptoPanic + CoinSpectator
- [ ] X (Twitter) auto-post on publish
- [ ] Google Search Console setup + sitemap submit

### Analytics
- [ ] Plausible or Umami install
- [ ] Monthly content audit process

---

## Anti-patterns to Avoid in 2027

- ❌ Keyword stuffing in titles — AI detects, hurts CTR
- ❌ Thin content < 400 words — Google filters AI-generated if no added value
- ❌ Duplicate topics without differentiation — semantic dedup needed
- ❌ Missing financial disclaimers — YMYL manual penalty risk
- ❌ No author attribution — instant E-E-A-T red flag
- ❌ Images without alt text — accessibility = ranking signal
- ❌ Links to low-trust sources — trust flows both ways
