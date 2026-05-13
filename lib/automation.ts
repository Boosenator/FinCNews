import { supabaseAdmin } from "@/lib/supabase";
import { createTelegraphPage } from "@/lib/telegraph";

type FeedEntry = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
};

function extractCdata(xml: string, tag: string): string {
  // Handle CDATA: <tag><![CDATA[text]]></tag>
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, "i");
  const cdataMatch = xml.match(cdataRe);
  if (cdataMatch) return cdataMatch[1].trim();

  // Plain text: <tag>text</tag>
  const plainRe = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i");
  const plainMatch = xml.match(plainRe);
  if (plainMatch) return plainMatch[1].trim();

  return "";
}

function extractLink(itemXml: string): string {
  // Try <link>url</link>
  const plain = itemXml.match(/<link>([^<]+)<\/link>/i);
  if (plain) return plain[1].trim();
  // Try <link href="url" .../>
  const attr = itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (attr) return attr[1].trim();
  // Fallback to guid
  return extractCdata(itemXml, "guid");
}

async function parseFeed(url: string): Promise<FeedEntry[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "FinCNews-Bot/1.0" },
    // no-store: skip Next.js cache so we always get fresh RSS
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const xml = await res.text();

  // Support both RSS <item> and Atom <entry>
  const itemRe = /<(item|entry)[\s>][\s\S]*?<\/(item|entry)>/gi;
  const items: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && items.length < 20) {
    items.push(m[0]);
  }

  return items.map((item) => ({
    title: extractCdata(item, "title"),
    link: extractLink(item),
    pubDate: extractCdata(item, "pubDate") || extractCdata(item, "published") || extractCdata(item, "updated"),
    contentSnippet: extractCdata(item, "description")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400),
  }));
}

const KEYWORDS = [
  // Crypto — core terms (substring match ok for these, they're unambiguous)
  "bitcoin","ethereum","solana","crypto","blockchain","altcoin","defi","nft",
  "token","wallet","exchange","staking","yield","liquidity","protocol","web3",
  "mining","validator","airdrop","stablecoin","CBDC","memecoin","layer2",
  // Crypto events
  "ETF","ETFs","hack","exploit","listing","fork","upgrade","halving",
  // Policy / regulation
  "regulation","SEC","CFTC","MiCA","compliance","sanctions","ban",
  // Macro / economy
  "Fed","Federal Reserve","rate hike","rate cut","CPI","inflation","recession",
  "FOMC","ECB","GDP","unemployment","stagflation",
  // Markets
  "earnings","IPO","merger","acquisition","bankruptcy","layoffs","buyback",
  "stock","stocks","market","rally","crash","correction","bull","bear",
  "gold","silver","oil","commodity","futures","bonds","treasury","yield curve",
  // Fintech
  "payment","neobank","fintech","PayPal","Stripe","Revolut","SWIFT","IBAN",
];

// ─── Hype Score ───────────────────────────────────────────────────────────────

const BREAKING_SIGNALS = [
  "confirms","breaks record","crashes","surges","collapses","plummets",
  "hacked","exploited","launches","arrested","bankrupt","emergency",
  "all-time high","ath","record high","record low","just announced","breaking",
];

const HIGH_VALUE_TERMS = [
  "bitcoin","ethereum","etf","etfs","fed","sec","cpi","earnings","ipo",
  "billion","trillion","hack","exploit","acquisition","merger","bankruptcy",
  "rate cut","rate hike","clarity act","federal reserve",
];

const QUALITY_SOURCES = ["CoinDesk","Bloomberg","Reuters","The Block","Decrypt","CNBC"];

export function calculateHypeScore(item: {
  title?: string;
  contentSnippet?: string;
  pubDate?: string;
  sourceName?: string;
}): number {
  let score = 35;

  const title = (item.title ?? "").toLowerCase();
  const text = `${title} ${(item.contentSnippet ?? "").toLowerCase()}`;

  // Breaking/urgency signal (+25)
  if (BREAKING_SIGNALS.some((w) => title.includes(w))) score += 25;

  // High-value keyword density (+20 max)
  const matches = HIGH_VALUE_TERMS.filter((w) => text.includes(w)).length;
  score += Math.min(matches * 5, 20);

  // Recency — the main freshness factor
  if (item.pubDate) {
    const ageH = (Date.now() - new Date(item.pubDate).getTime()) / 3600000;
    if (ageH < 1)       score += 25;
    else if (ageH < 3)  score += 15;
    else if (ageH < 6)  score += 5;
    else if (ageH < 12) score -= 5;
    else                score -= 25; // stale — penalise heavily
  }

  // Source quality (+10)
  if (QUALITY_SOURCES.some((s) => (item.sourceName ?? "").includes(s))) score += 10;

  // Specific numbers in title — specificity = credibility (+10)
  if (/\$[\d,.]+[BKMbkm]?|\d+\.?\d*%|\d+[BKMbkm]\b/i.test(item.title ?? "")) score += 10;

  return Math.max(0, Math.min(100, score));
}

// Escape special regex chars
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word boundary for short/ambiguous words, substring for long unique ones
function matchesKeyword(text: string, kw: string): boolean {
  // Short words (≤5 chars) use word boundary to avoid "ban"→"bank"
  // Long words (>5 chars) use simple includes — they're specific enough
  if (kw.length <= 5) {
    return new RegExp(`\\b${escapeRe(kw)}\\b`, "i").test(text);
  }
  return text.toLowerCase().includes(kw.toLowerCase());
}

function hasKeyword(text: string): boolean {
  return KEYWORDS.some((kw) => matchesKeyword(text, kw));
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  crypto:    ["bitcoin","ethereum","solana","ETF","crypto","blockchain","DeFi","NFT","token","hack","exploit","listing","fork","airdrop"],
  markets:   ["stock","S&P","nasdaq","dow","gold","oil","futures","earnings","IPO","index","rally","selloff"],
  economy:   ["Fed","rate","CPI","inflation","GDP","recession","FOMC","Powell","ECB","central bank","unemployment"],
  fintech:   ["payment","neobank","stablecoin","CBDC","banking","stripe","revolut","fintech","digital wallet"],
  policy:    ["SEC","CFTC","MiCA","regulation","ban","law","congress","compliance","sanctions"],
  companies: ["earnings","revenue","acquisition","merger","layoffs","IPO","quarterly","profit","loss","guidance"],
};

function detectCategory(text: string, sourceCategory: string): string {
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[cat] = kws.filter((kw) => matchesKeyword(lower, kw)).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : sourceCategory;
}

async function tryFetchArticleText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  } catch {
    return "";
  }
}

async function callClaude(item: { title: string; pubDate?: string }, bodyText: string, category: string): Promise<Record<string, unknown>> {
  // Trim body early — Haiku handles 1500 chars well, saves input tokens
  const body = bodyText.slice(0, 1500);
  const date = item.pubDate ? item.pubDate.slice(0, 10) : new Date().toISOString().slice(0, 10);

  const prompt = `Financial journalist. Output ONLY raw JSON, no markdown.

Title: ${item.title}
Date: ${date} | Category: ${category}
Text: ${body}

JSON:
{"slug":"kebab-max-60","category":"${category}","tags":["t1","t2","t3"],"translations":{"en":{"title":"SEO title 50-60 chars","excerpt":"2-3 sentences under 250 chars","body":"400-500 word article: What happened (facts+numbers) → Why it matters → Expert take (first person) → How to act. End: Not financial advice.","metaTitle":"50-60 chars","metaDescription":"150-160 chars with CTA","telegramText":"120w news recap ending [ARTICLE_URL]"}}}

Rules: facts only, real numbers/dates, slug≤60 chars.
In the body, naturally reference 1-2 related topics using format [INTERNAL: topic] — e.g. [INTERNAL: Bitcoin ETF] or [INTERNAL: Federal Reserve rates]. These become internal links.`;


  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude returned non-JSON");
  return JSON.parse(jsonMatch[0]);
}

// Returns 0–1: fraction of significant words in common
function titleSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    s.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const wa = words(a);
  const wb = new Set(words(b));
  const intersection = wa.filter((w) => wb.has(w)).length;
  const allWords = new Set([...wa, ...words(b)]);
  const union = allWords.size;
  return union === 0 ? 0 : intersection / union;
}

// Build specific Pexels search query from article context
function buildImageQuery(category: string, tags?: string[], title?: string): string {
  const STOP_WORDS = new Set([
    "the","a","an","and","or","but","in","on","at","to","for","of","with","as",
    "is","was","are","were","has","have","will","would","after","before","than",
    "that","this","from","into","over","just","its","their","our","amid","amid",
    "says","says","back","new","via","per","how","why","what","when","where",
  ]);

  // Priority 1: article tags → most specific (e.g. "memecoin", "solana", "istanbul")
  if (tags && tags.length > 0) {
    const meaningful = tags
      .map((t) => t.replace(/-/g, " ").toLowerCase())
      .filter((t) => t.length > 3 && !STOP_WORDS.has(t))
      .slice(0, 2);
    if (meaningful.length > 0) return `${meaningful.join(" ")} finance`;
  }

  // Priority 2: key nouns from title (entities, organizations, topics)
  if (title) {
    const words = title
      .split(/\W+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 4 && !STOP_WORDS.has(w));
    if (words.length >= 2) return `${words.slice(0, 3).join(" ")}`;
  }

  // Priority 3: category fallback
  const categoryMap: Record<string, string> = {
    crypto:    "cryptocurrency digital assets trading",
    markets:   "stock market trading finance chart",
    economy:   "federal reserve central bank economy",
    fintech:   "mobile payment technology fintech",
    policy:    "law regulation government finance",
    companies: "corporate office business earnings",
  };
  return categoryMap[category] ?? "finance business";
}

// Returns Pexels photo URL (medium size) for use in Telegram, or null on failure
async function attachPexelsImage(
  sanityDocId: string,
  slug: string,
  category: string,
  tags?: string[],
  title?: string,
): Promise<string | null> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return null;

  const query = buildImageQuery(category, tags, title);

  try {
    const search = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      { headers: { Authorization: pexelsKey }, signal: AbortSignal.timeout(5000) },
    );
    if (!search.ok) return null;
    const { photos } = await search.json();
    const idx = Math.floor(Math.random() * Math.min(photos?.length ?? 0, 10));
    const photoUrl: string = photos?.[idx]?.src?.large2x;
    const telegramPhotoUrl: string = photos?.[idx]?.src?.large; // smaller for Telegram
    if (!photoUrl) return null;

    const imgRes = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return null;
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const { createClient } = await import("@sanity/client");
    const sanity = createClient({
      projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
      dataset: process.env.SANITY_DATASET ?? "production",
      token: process.env.SANITY_TOKEN!,
      apiVersion: "2024-01-01",
      useCdn: false,
    });

    const asset = await sanity.assets.upload("image", buffer, {
      filename: `${slug}.jpg`,
      contentType: "image/jpeg",
    });

    await sanity.patch(sanityDocId).set({
      coverImage: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
    }).commit();

    return telegramPhotoUrl ?? null;
  } catch {
    return null;
  }
}

async function publishToSanity(article: Record<string, unknown>): Promise<string> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";
  const res = await fetch(`${base}/api/publish`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.N8N_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(article),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Publish failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.id as string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  crypto:    "₿",
  markets:   "📈",
  economy:   "🏦",
  fintech:   "⚡",
  policy:    "⚖️",
  companies: "🏢",
};

// Escape HTML for Telegram
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Detect if title signals breaking/urgent news
function isBreaking(title: string): boolean {
  const words = ["confirms", "launches", "crashes", "breaks record", "hits", "surges",
    "drops", "collapses", "banned", "arrests", "hacked", "exploited", "just announced"];
  return words.some((w) => title.toLowerCase().includes(w));
}

// Pick CTA that fits the article
function pickCta(title: string, category: string): string {
  if (isBreaking(title)) {
    const opts = ["What this means →", "Breaking down what happened →", "Full story →", "Here's the context →"];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  const byCat: Record<string, string[]> = {
    crypto:    ["Full breakdown →", "Read the analysis →", "Get the details →", "Dive deeper →"],
    markets:   ["Market analysis →", "Numbers inside →", "Full picture →"],
    economy:   ["What this means for your money →", "Full macro breakdown →", "Read more →"],
    fintech:   ["Full story →", "Read more →", "Get the details →"],
    policy:    ["Full analysis →", "What changes →", "Read more →"],
    companies: ["Earnings breakdown →", "Full story →", "Read more →"],
  };
  const opts = byCat[category] ?? ["Read more →", "Full story →", "Get the details →"];
  return opts[Math.floor(Math.random() * opts.length)];
}

type TelegramPost = {
  title: string;
  excerpt: string;
  url: string;          // Telegraph URL (or site as fallback)
  siteUrl?: string;     // always the site URL (shown as secondary link)
  category: string;
  tags?: string[];
  photoUrl?: string | null;
};

async function sendTelegram(post: TelegramPost) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) return;

  const emoji = CATEGORY_EMOJI[post.category] ?? "📰";
  const breaking = isBreaking(post.title);
  const cta = pickCta(post.title, post.category);

  // Hashtags: article tags + category + brand
  const tagList = (post.tags ?? [])
    .slice(0, 3)
    .map((t) => `#${t.replace(/\s+/g, "")}`)
    .join(" ");
  const hashtags = [tagList, `#${post.category}`, "#FinCNews"].filter(Boolean).join(" ");

  // Header line — "🚨 BREAKING" vs "₿ CRYPTO" vs "📈 MARKETS"
  const header = breaking
    ? `🚨 <b>BREAKING</b>`
    : `${emoji} <b>${post.category.toUpperCase()}</b>`;

  const isTelegraph = post.url.includes("telegra.ph");

  // Compact excerpt — 1-2 punchy sentences for Telegram scroll
  const shortExcerpt = post.excerpt.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");

  const caption = [
    header,
    ``,
    `<b>${esc(post.title)}</b>`,
    ``,
    esc(shortExcerpt),
    ``,
    // Curiosity trigger + single CTA
    isTelegraph
      ? `${cta.includes("→") ? cta.replace("→", "👇") : `What this means 👇`}`
      : cta,
    `<a href="${post.url}">${post.url}</a>`,
    ``,
    hashtags,
  ].join("\n");

  // If photo URL available → sendPhoto (more visual impact)
  // Otherwise → sendMessage with link preview
  if (post.photoUrl) {
    await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        photo: post.photoUrl,
        caption,
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(15000),
    });
  } else {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: false, prefer_large_media: true },
      }),
      signal: AbortSignal.timeout(10000),
    });
  }
}

export type DetailEntry = {
  url: string;
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  bodyPreview?: string;
  imageAttached?: boolean;
  score?: number;
  status: "published" | "error" | "skipped";
  error?: string;
};

export type AutomationResult = {
  articlesFound: number;
  articlesAfterKeywords: number;
  articlesAfterUrlDedup: number;
  articlesAfterSemanticDedup: number;
  articlesPublished: number;
  articlesSkipped: number;
  durationMs: number;
  sampleTitles: string[];   // first 3 raw titles for debug
  details: DetailEntry[];
};

export async function runAutomation(maxArticles = 2): Promise<AutomationResult> {
  const start = Date.now();
  const db = supabaseAdmin();

  const { data: sources } = await db.from("rss_sources").select("*").eq("enabled", true);
  if (!sources?.length) return { articlesFound: 0, articlesAfterKeywords: 0, articlesAfterUrlDedup: 0, articlesAfterSemanticDedup: 0, articlesPublished: 0, articlesSkipped: 0, durationMs: Date.now() - start, sampleTitles: [], details: [] };

  type FeedItem = { title?: string; link?: string; pubDate?: string; contentSnippet?: string; sourceCategory: string; sourceName: string };

  // Fetch all sources in parallel — ~8s max instead of 10×8s=80s
  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const entries = await parseFeed(source.url);
      // update last_fetched_at in background, don't await
      void db.from("rss_sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("id", source.id);
      return entries.map((item) => ({
        ...item,
        sourceCategory: source.category,
        sourceName: source.name,
      }));
    })
  );

  const allItems: FeedItem[] = results
    .filter((r): r is PromiseFulfilledResult<FeedItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  // Filter: link required, < 48h old, contains finance keywords
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const fresh = allItems.filter((item) => {
    if (!item.link) return false;                                    // must have URL
    const age = new Date(item.pubDate ?? 0).getTime();
    if (item.pubDate && age > 0 && age < cutoff) return false;      // too old
    const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`;
    if (text.trim().length < 10) return false;
    return hasKeyword(text);
  });

  // Step 1: URL dedup
  const urls = fresh.map((i) => i.link!).filter(Boolean);
  const { data: existing } = await db.from("processed_urls").select("url").in("url", urls);
  const seenUrls = new Set((existing ?? []).map((r: { url: string }) => r.url));
  const afterUrlDedup = fresh.filter((i) => !seenUrls.has(i.link!));

  // Step 2: Semantic dedup — skip if same story already published in last 48h
  const { data: recentTitles } = await db
    .from("processed_urls")
    .select("title")
    .gte("published_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .not("title", "is", null);
  const recentTitleList = (recentTitles ?? []).map((r: { title: string }) => r.title);
  const newItems = afterUrlDedup.filter((item) => {
    return !recentTitleList.some((t) => titleSimilarity(item.title ?? "", t) > 0.5);
  });

  const toProcess = newItems.slice(0, maxArticles);
  const skipped = fresh.length - newItems.length;
  const details: AutomationResult["details"] = [];

  for (const item of toProcess) {
    try {
      // RSS excerpt is always available — use full scrape as bonus if site allows it
      const rssText = item.contentSnippet ?? "";
      const scraped = await tryFetchArticleText(item.link!);
      const bodyText = scraped.length > 300 ? scraped : rssText;

      const category = detectCategory(`${item.title} ${rssText}`, item.sourceCategory);
      const article = await callClaude({ title: item.title ?? "Untitled", pubDate: item.pubDate }, bodyText, category);

      const en = (article.translations as Record<string, Record<string, string>>)?.en;
      if (!en?.title || !en.excerpt || !en.body) throw new Error("Claude returned incomplete article");

      // Add sourceUrl
      article.sourceUrl = item.link;

      const sanityId = await publishToSanity(article);

      // Image before Telegram — pass tags + title for specific search
      const photoUrl = await attachPexelsImage(
        sanityId,
        article.slug as string,
        category,
        article.tags as string[] | undefined,
        en.title,
      );

      await db.from("processed_urls").insert({
        url: item.link,
        slug: article.slug,
        title: en.title,
        category,
      });

      await db.from("rss_sources")
        .update({ articles_published: sources.find((s) => s.category === item.sourceCategory)?.articles_published ?? 0 + 1 })
        .eq("category", item.sourceCategory);

      const articleUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app"}/${category}/${article.slug}`;
      await sendTelegram({
        title: en.title,
        excerpt: en.excerpt,
        url: articleUrl,
        category,
        tags: (article.tags as string[] | undefined),
        photoUrl,
      });

      details.push({
        url: item.link!,
        title: en.title,
        slug: article.slug as string,
        category,
        excerpt: en.excerpt,
        bodyPreview: (typeof en.body === "string" ? en.body : "").slice(0, 400),
        imageAttached: !!process.env.PEXELS_API_KEY,
        status: "published",
      });
    } catch (e) {
      details.push({ url: item.link!, title: item.title, status: "error", error: String(e) });
    }
  }

  return {
    articlesFound: allItems.length,
    articlesAfterKeywords: fresh.length,
    articlesAfterUrlDedup: afterUrlDedup.length,
    articlesAfterSemanticDedup: newItems.length,
    articlesPublished: details.filter((d) => d.status === "published").length,
    articlesSkipped: skipped,
    durationMs: Date.now() - start,
    sampleTitles: allItems.slice(0, 5).map((i) => i.title ?? "(empty)"),
    details,
  };
}

// ─── Variant B: split collect / generate ──────────────────────────────────

export type CollectResult = {
  sourcesChecked: number;
  itemsFound: number;
  itemsAfterKeywords: number;
  itemsAfterDedup: number;
  itemsQueued: number;
  itemsSkipped: number;
  durationMs: number;
  debug: {
    sampleTitles: string[];          // first 5 raw titles before filter
    sampleAfterKeywords: string[];   // first 5 titles that passed keyword filter
    insertError?: string;
  };
};

export async function runCollect(): Promise<CollectResult> {
  const start = Date.now();
  const db = supabaseAdmin();

  const { data: sources } = await db.from("rss_sources").select("*").eq("enabled", true);
  const emptyDebug = { sampleTitles: [], sampleAfterKeywords: [] };
  if (!sources?.length) {
    return { sourcesChecked: 0, itemsFound: 0, itemsAfterKeywords: 0, itemsAfterDedup: 0, itemsQueued: 0, itemsSkipped: 0, durationMs: Date.now() - start, debug: emptyDebug };
  }

  type FeedItem = { title?: string; link?: string; pubDate?: string; contentSnippet?: string; sourceCategory: string; sourceName: string };

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const entries = await parseFeed(source.url);
      void db.from("rss_sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", source.id);
      return entries.map((e) => ({ ...e, sourceCategory: source.category, sourceName: source.name }));
    }),
  );

  const allItems: FeedItem[] = results
    .filter((r): r is PromiseFulfilledResult<FeedItem[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const sampleTitles = allItems.slice(0, 5).map((i) => `[${i.sourceCategory}] ${i.title ?? "(empty)"}`);

  // ── 12h collection window (was 48h) ──────────────────────────────────────
  const COLLECTION_WINDOW_H = 12;
  const cutoff = Date.now() - COLLECTION_WINDOW_H * 60 * 60 * 1000;
  const MIN_SCORE = 45; // articles below this threshold are not queued

  const fresh = allItems.filter((item) => {
    if (!item.link) return false;
    const age = new Date(item.pubDate ?? 0).getTime();
    if (item.pubDate && age > 0 && age < cutoff) return false;
    const text = `${item.title ?? ""} ${item.contentSnippet ?? ""}`;
    return text.trim().length >= 10 && hasKeyword(text);
  });

  const sampleAfterKeywords = fresh.slice(0, 5).map((i) => i.title ?? "(empty)");

  if (!fresh.length) {
    return { sourcesChecked: sources.length, itemsFound: allItems.length, itemsAfterKeywords: 0, itemsAfterDedup: 0, itemsQueued: 0, itemsSkipped: 0, durationMs: Date.now() - start, debug: { sampleTitles, sampleAfterKeywords } };
  }

  // ── Score every item ──────────────────────────────────────────────────────
  const scored = fresh.map((item) => ({
    ...item,
    score: calculateHypeScore({
      title: item.title,
      contentSnippet: item.contentSnippet,
      pubDate: item.pubDate,
      sourceName: item.sourceName,
    }),
  }));

  // ── Remove stale low-score items already in queue ─────────────────────────
  void db.from("article_queue")
    .delete()
    .eq("status", "pending")
    .lt("queued_at", new Date(Date.now() - COLLECTION_WINDOW_H * 60 * 60 * 1000).toISOString())
    .lt("score", MIN_SCORE);

  const urls = scored.map((i) => i.link!);

  // Dedup: already published OR already in queue
  const [{ data: processed }, { data: queued }] = await Promise.all([
    db.from("processed_urls").select("url").in("url", urls),
    db.from("article_queue").select("url").in("url", urls),
  ]);
  const seen = new Set([
    ...(processed ?? []).map((r: { url: string }) => r.url),
    ...(queued ?? []).map((r: { url: string }) => r.url),
  ]);

  // Semantic dedup against recent 12h titles
  const { data: recentTitles } = await db
    .from("processed_urls")
    .select("title")
    .gte("published_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .not("title", "is", null);
  const recentTitleList = (recentTitles ?? []).map((r: { title: string }) => r.title);

  const newItems = scored.filter((item) => {
    if (seen.has(item.link!)) return false;
    if (item.score < MIN_SCORE) return false; // below hype threshold
    return !recentTitleList.some((t) => titleSimilarity(item.title ?? "", t) > 0.5);
  });

  if (!newItems.length) {
    return { sourcesChecked: sources.length, itemsFound: allItems.length, itemsAfterKeywords: fresh.length, itemsAfterDedup: 0, itemsQueued: 0, itemsSkipped: fresh.length, durationMs: Date.now() - start, debug: { sampleTitles, sampleAfterKeywords } };
  }

  const rows = newItems
    .filter((item) => !!item.link)
    .map((item) => ({
      url: item.link!,
      title: item.title || null,
      snippet: item.contentSnippet || null,
      source_category: item.sourceCategory,
      source_name: item.sourceName || null,
      pub_date: item.pubDate || null,
      score: item.score,
    }));

  if (!rows.length) {
    return { sourcesChecked: sources.length, itemsFound: allItems.length, itemsAfterKeywords: fresh.length, itemsAfterDedup: newItems.length, itemsQueued: 0, itemsSkipped: fresh.length, durationMs: Date.now() - start, debug: { sampleTitles, sampleAfterKeywords } };
  }

  const { data: inserted, error: insertError } = await db
    .from("article_queue")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
    .select("id");

  if (insertError) {
    // Log but don't throw — partial success is acceptable
    console.error("[collect] queue insert error:", insertError.message);
  }

  return {
    sourcesChecked: sources.length,
    itemsFound: allItems.length,
    itemsAfterKeywords: fresh.length,
    itemsAfterDedup: newItems.length,
    itemsQueued: inserted?.length ?? 0,
    itemsSkipped: fresh.length - newItems.length,
    durationMs: Date.now() - start,
    debug: {
      sampleTitles,
      sampleAfterKeywords,
      insertError: insertError?.message,
    },
  };
}

export type GenerateResult = {
  queueSize: number;
  articlesPublished: number;
  durationMs: number;
  details: DetailEntry[];
};

export async function runGenerate(maxArticles = 2): Promise<GenerateResult> {
  const start = Date.now();
  const db = supabaseAdmin();

  // Reset stuck "processing" items older than 10 min back to pending
  void db.from("article_queue")
    .update({ status: "pending" })
    .eq("status", "processing")
    .lt("queued_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

  // Pick highest-scoring articles first, then oldest
  const { data: items } = await db
    .from("article_queue")
    .select("*")
    .eq("status", "pending")
    .order("score", { ascending: false })
    .order("queued_at", { ascending: true })
    .limit(maxArticles);

  if (!items?.length) {
    return { queueSize: 0, articlesPublished: 0, durationMs: Date.now() - start, details: [] };
  }

  const details: DetailEntry[] = [];

  for (const item of items) {
    await db.from("article_queue").update({ status: "processing" }).eq("id", item.id);
    try {
      const scraped = await tryFetchArticleText(item.url);
      const bodyText = scraped.length > 300 ? scraped : (item.snippet ?? "");
      const category = detectCategory(`${item.title ?? ""} ${item.snippet ?? ""}`, item.source_category);
      const article = await callClaude({ title: item.title ?? "Untitled", pubDate: item.pub_date }, bodyText, category);

      const en = (article.translations as Record<string, Record<string, string>>)?.en;
      if (!en?.title || !en.excerpt || !en.body) throw new Error("Claude returned incomplete article");

      article.sourceUrl = item.url;
      const sanityId = await publishToSanity(article);

      // 1. Attach image — specific query from tags + title
      const photoUrl = await attachPexelsImage(
        sanityId,
        article.slug as string,
        category,
        article.tags as string[] | undefined,
        en.title,
      );

      const articleUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app"}/${category}/${article.slug}`;
      const enBodyText = typeof en.body === "string" ? en.body : "";

      // 2. Create Telegraph page (backlink DR90+ → site)
      const telegraph = await createTelegraphPage({
        title: en.title,
        excerpt: en.excerpt,
        bodyPreview: enBodyText.slice(0, 800),
        siteUrl: articleUrl,
        category,
      });

      // 3. Patch Sanity with Telegraph URL
      if (telegraph) {
        const { createClient } = await import("@sanity/client");
        const sc = createClient({
          projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
          dataset: process.env.SANITY_DATASET ?? "production",
          token: process.env.SANITY_TOKEN!,
          apiVersion: "2024-01-01",
          useCdn: false,
        });
        void sc.patch(sanityId).set({ telegraphUrl: telegraph.url }).commit();
      }

      await db.from("processed_urls").insert({ url: item.url, slug: article.slug, title: en.title, category });
      await db.from("article_queue").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", item.id);

      // 4. Send Telegram → links to Telegraph (which links to site)
      await sendTelegram({
        title: en.title,
        excerpt: en.excerpt,
        url: telegraph?.url ?? articleUrl,   // Telegraph URL first, site as fallback
        siteUrl: articleUrl,
        category,
        tags: (article.tags as string[] | undefined),
        photoUrl,
      });

      details.push({ url: item.url, title: en.title, slug: article.slug as string, category, excerpt: en.excerpt, bodyPreview: (typeof en.body === "string" ? en.body : "").slice(0, 400), imageAttached: !!process.env.PEXELS_API_KEY, score: item.score, status: "published" });
    } catch (e) {
      await db.from("article_queue").update({ status: "error", error_text: String(e), processed_at: new Date().toISOString() }).eq("id", item.id);
      details.push({ url: item.url, title: item.title, status: "error", error: String(e) });
    }
  }

  return {
    queueSize: items.length,
    articlesPublished: details.filter((d) => d.status === "published").length,
    durationMs: Date.now() - start,
    details,
  };
}
