# FinCNews SEO Plan

This document reflects the current FinCNews SEO architecture as of May 31, 2026.

FinCNews is a finance and crypto YMYL site. The SEO goal is not only to publish fresh news, but to build crawlable category archives, evergreen topic hubs, strong internal links, and enough editorial trust signals for Google Search, Google News, Discover, and AI answer surfaces.

## Current SEO Status

Implemented:

- Article pages with `NewsArticle`, `BreadcrumbList`, and `Speakable` JSON-LD
- Homepage with `WebSite` and `Organization` JSON-LD
- Topic hub pages with `CollectionPage` and `FAQPage` JSON-LD
- Canonical URLs on articles, categories, topic hubs, and archive pages
- Open Graph and Twitter metadata
- Google News sitemap at `/news-sitemap.xml`
- Full sitemap at `/sitemap.xml`
- Category archive pagination, so old articles are reachable through HTML links
- Topic hub index at `/topics`
- Topic hub pages at `/topics/{slug}`
- `/about` and `/editorial-policy` pages
- Financial disclaimer on article pages
- Robots rules for admin/API areas
- Middleware fast 404 for WordPress/PHP probe paths

Known gaps:

- No named author `Person` schema yet
- Article OG images still rely mostly on generic/default OG behavior
- Google Search Console and Publisher Center setup still need manual completion
- Analytics and monthly SEO audit process need formalization

## Indexation Strategy

Pages should not depend only on `sitemap.xml`. Google should be able to discover important URLs through internal HTML links.

Current crawl paths:

- Homepage links to latest articles, categories, and selected topic hubs.
- Category pages link to recent articles.
- Paginated category archives expose older articles through `/category/page/2`, `/category/page/3`, etc.
- Topic hubs link to related articles through contextual anchors and sidebar cards.
- Header and footer link to `/topics`.
- Sitemap includes article URLs, category URLs, archive URLs, `/topics`, and individual topic hubs.

Manual request indexing is only useful for priority URLs. It should not be required for every article.

Priority URLs for manual indexing:

- Homepage
- `/topics`
- high-value topic hubs such as `/topics/bitcoin`
- major category pages
- major evergreen or high-quality news articles

## Topic Hubs

Topic hubs are evergreen authority pages maintained by the editorial agent.

Current planned topics:

- Bitcoin
- Ethereum
- Crypto ETFs
- SEC Crypto Regulation
- Federal Reserve Policy
- Stablecoins
- XRP
- Solana

Topic hub document IDs must be public Sanity IDs:

```text
topicHub-bitcoin
topicHub-ethereum
```

Do not use dotted IDs:

```text
topicHub.bitcoin
```

Sanity treats dotted IDs as private paths that require a token, so the public frontend may 404 even when the admin token can see the document.

## Topic Hub Agent

The topic hub system has two agents:

- Topic Discovery Agent: suggests new evergreen hub candidates for human approval.
- Topic Hub Agent: refreshes approved durable evergreen pages.

The refresh agent is designed to explain broad topics, not recap recent news.

Schedule:

- Discovery: `/api/cron/editorial/discovery` at `02:30 UTC`, currently `05:30 Kyiv`
- Morning: `/api/cron/editorial/morning` at `03:00 UTC`, currently `06:00 Kyiv`
- Evening: `/api/cron/editorial/evening` at `14:00 UTC`, currently `17:00 Kyiv`

Discovery logic:

1. Analyze FinCNews articles from the last 72 hours.
2. Compare emerging themes against approved static and dynamic topic plans.
3. Suggest only missing topics that can stay evergreen for 3-6 months.
4. Require at least 3 related recent articles or a clear multi-article pattern.
5. Store candidates as `editorialTopicSuggestion-{slug}` with `suggested`, `approved`, or `dismissed` status.

Admin actions:

- `Analyze new topics` runs discovery manually.
- `Approve` adds the suggestion as an approved dynamic topic plan.
- `Create hub` approves the suggestion and immediately creates the hub.
- `Dismiss` removes it from the pending suggestions list.

Refresh logic:

1. Once per Kyiv day, score configured and approved topic plans by recent related coverage.
2. Use recent 24-hour and 72-hour article counts.
3. Select the top two hot topics.
4. Refresh the first in the morning and the second in the evening.
5. Store the daily plan in Sanity as `editorialHotPlan-YYYY-MM-DD`.

The agent uses Anthropic tool output, not raw JSON text, to prevent malformed JSON errors.

Output fields:

- `title`
- `description`
- `body`
- `faqs`

Required body sections:

- `What It Is`
- `Why It Matters`
- `Latest Developments`
- `What to Watch`
- `FinCNews View`
- `How FinCNews Covers It`

Internal linking rules:

- Include 4-8 contextual markdown links.
- Use only allowed internal targets from recent related FinCNews coverage.
- Use descriptive anchor text.
- Put links inside paragraphs.
- Never add a standalone "Related Coverage" list.

The code also has a fallback that weaves contextual links into `How FinCNews Covers It` if the model under-links.

## News Article Agent

The news article agent writes factual news from source reports.

Current editorial positioning:

- journalist, not analyst
- no unsupported speculation
- facts only from source text
- Bloomberg/Reuters/CoinDesk/The Block style target
- accuracy first, then clarity, context, relevance

Required body sections:

- `What Happened`
- `Key Details`
- `Why It Matters`
- `What Happens Next`

Article length adapts to story importance:

- Minor update: 250-450 words
- Standard news: 400-700 words
- Major market-moving story: 700-1000 words

The prompt requires the differentiator to appear in:

- title
- slug
- excerpt
- metaTitle

This is intended to reduce duplicate angles and thin repeated coverage.

## Internal Linking

Current internal linking layers:

- Related article sidebar on article pages
- Related article sidebar on topic hub pages
- Contextual topic hub links generated by the topic agent
- Category archive links
- Homepage category and topic hub sections

Next improvements:

- Add topic hub links from article pages when tags match a hub.
- Add breadcrumb or "Topic" chips linking from articles to hubs.
- Add curated hub modules on category pages.
- Add a recurring audit for orphan URLs.

## Structured Data

Implemented:

| Schema | Page Type | Status |
| --- | --- | --- |
| `NewsArticle` | Article | Done |
| `BreadcrumbList` | Article, category | Done |
| `Speakable` | Article | Done |
| `WebSite` | Homepage | Done |
| `Organization` | Homepage | Done |
| `CollectionPage` | Topic hub | Done |
| `FAQPage` | Topic hub | Done |

To add:

- `Person` or stronger author entity
- `disclaimer` field in article structured data if supported cleanly
- richer `ItemList` modules for categories and topic indexes

## Crawl And Technical SEO

Implemented:

- `/robots.txt`
- `/sitemap.xml`
- `/news-sitemap.xml`
- canonical URLs
- server-rendered article/topic pages
- paginated category archives
- middleware block for `.php`, `/wp-admin`, `/wp-login.php`, `/xmlrpc.php`, `/wp-content`, `/wp-includes`

Notes:

- WordPress probes are expected bot noise. They now return fast 404s before hitting the article route.
- Category pagination is important because sitemap-only discovery is weaker than internal HTML discovery.
- GSC "Discovered, currently not indexed" should be handled by improving internal links, quality, and crawl paths, not by manually submitting every URL.

## E-E-A-T

Implemented:

- `/about`
- `/editorial-policy`
- visible article disclaimer
- source URL stored and displayed
- fact-focused news prompt
- topic hub authority prompt

Recommended next:

- Add named editorial author entity.
- Add author profile page.
- Make source attribution more visible.
- Add correction/update notes where relevant.
- Add `/advertise` or monetization transparency page if monetization begins.

## Google News And Discover

Ready:

- Recent news sitemap
- publication dates
- article structured data
- cover image pipeline
- editorial policy page

Still needed:

- Google News Publisher Center submission
- Search Console sitemap submission
- stronger author/byline signals
- monitor Discover image quality and article originality

## Analytics And Audits

Recommended monthly audit:

- URLs discovered but not indexed
- articles with 0 impressions after 30 days
- articles with high impressions but low CTR
- orphan articles not linked from category/archive/topic pages
- topic hubs with stale related coverage
- duplicate or near-duplicate article angles

Recommended tracking:

- organic clicks and impressions
- indexed article count
- indexed topic hub count
- category archive crawl activity
- topic hub assisted clicks
- Telegram -> Telegraph -> site referral flow

## Current SEO Priorities

1. Merge and deploy the current SEO/topic hub branch.
2. Confirm `/topics/bitcoin` and other hubs are live with the new formatting.
3. Submit `/sitemap.xml` and `/news-sitemap.xml` in Search Console.
4. Request indexing for homepage, `/topics`, key topic hubs, and main categories.
5. Add article-to-topic-hub links.
6. Add stronger author entity and byline schema.
7. Set up monthly indexation and content quality audit.

## Anti-Patterns

Avoid:

- raw plain URL lists in content
- FAQ text duplicated inside article body
- dotted Sanity document IDs for public pages
- duplicate article angles without a clear differentiator
- invented prices, dates, market data, or legal status
- generic AI headline frames
- thin pages reachable only through sitemap
- linking from site articles back to Telegraph copies
- hiding source attribution too deeply
