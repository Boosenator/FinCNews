import { supabaseAdmin } from "@/lib/supabase";

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
      .slice(0, 4000);
  } catch {
    return "";
  }
}

async function callClaude(item: { title: string; pubDate?: string }, bodyText: string, category: string): Promise<Record<string, unknown>> {
  const prompt = `You are a senior financial journalist. Generate a finance news article as a single valid JSON object (no markdown, no code blocks — raw JSON only).

INPUT:
Title: ${item.title}
Published: ${item.pubDate ?? new Date().toISOString()}
Category: ${category}
Article text: ${bodyText.slice(0, 3000)}

OUTPUT JSON structure:
{
  "slug": "kebab-case-max-60-chars",
  "category": "${category}",
  "tags": ["tag1","tag2","tag3"],
  "translations": {
    "en": {
      "title": "SEO title 50-60 chars",
      "excerpt": "2-3 sentences with primary keyword, under 280 chars",
      "body": "800-1000 word article. Paragraphs separated by \\n\\n. Structure: What happened → Why it matters → Expert analysis (first person 'Based on my analysis...') → 3 scenarios (bull/base/bear) → How to act. End with: Not financial advice.",
      "metaTitle": "50-60 char meta title",
      "metaDescription": "150-160 char meta description with CTA",
      "telegramText": "Post1 (150w recap + [ARTICLE_URL]) ||| Post2 (100w portfolio impact) ||| Post3 (80w affiliate bridge + [AFFILIATE_URL])"
    }
  }
}

Rules: facts only, no invented quotes, include specific numbers/dates, slug max 60 chars.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
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

async function attachPexelsImage(sanityDocId: string, slug: string, category: string): Promise<void> {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return;

  const queryMap: Record<string, string> = {
    crypto: "bitcoin cryptocurrency blockchain",
    markets: "stock market trading finance chart",
    economy: "federal reserve central bank economy",
    fintech: "mobile payment technology fintech",
    policy: "law regulation government finance",
    companies: "corporate office business earnings",
  };
  const query = queryMap[category] ?? "finance business";

  try {
    const search = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: pexelsKey }, signal: AbortSignal.timeout(5000) },
    );
    if (!search.ok) return;
    const { photos } = await search.json();
    const photoUrl: string = photos?.[0]?.src?.large2x;
    if (!photoUrl) return;

    const imgRes = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return;
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
  } catch {
    // image is optional — never fail article publish because of it
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

async function sendTelegram(title: string, url: string, telegramText: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID;
  if (!token || !chatId) return;

  const post1 = (telegramText.split("|||")[0] ?? "").trim().replace("[ARTICLE_URL]", url);
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: post1,
      parse_mode: "Markdown",
      disable_web_page_preview: false,
    }),
  });
}

export type DetailEntry = {
  url: string;
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  bodyPreview?: string;
  imageAttached?: boolean;
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

      // Attach cover image from Pexels (non-blocking)
      void attachPexelsImage(sanityId, article.slug as string, category);

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
      await sendTelegram(en.title, articleUrl, en.telegramText ?? "");

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

  const sampleTitles = allItems.slice(0, 5).map((i) => `[${i.sourceCategory}] ${i.title ?? "(empty)"} | link:${i.link ? "✓" : "✗"} | snippet:${i.contentSnippet ? i.contentSnippet.slice(0, 40) : "(empty)"}`);

  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
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

  const urls = fresh.map((i) => i.link!);

  // Dedup: already published OR already in queue
  const [{ data: processed }, { data: queued }] = await Promise.all([
    db.from("processed_urls").select("url").in("url", urls),
    db.from("article_queue").select("url").in("url", urls),
  ]);
  const seen = new Set([
    ...(processed ?? []).map((r: { url: string }) => r.url),
    ...(queued ?? []).map((r: { url: string }) => r.url),
  ]);

  // Semantic dedup against recent 48h titles
  const { data: recentTitles } = await db
    .from("processed_urls")
    .select("title")
    .gte("published_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .not("title", "is", null);
  const recentTitleList = (recentTitles ?? []).map((r: { title: string }) => r.title);

  const newItems = fresh.filter((item) => {
    if (seen.has(item.link!)) return false;
    return !recentTitleList.some((t) => titleSimilarity(item.title ?? "", t) > 0.5);
  });

  if (!newItems.length) {
    return { sourcesChecked: sources.length, itemsFound: allItems.length, itemsAfterKeywords: fresh.length, itemsAfterDedup: 0, itemsQueued: 0, itemsSkipped: fresh.length, durationMs: Date.now() - start, debug: { sampleTitles, sampleAfterKeywords } };
  }

  // Filter out any items with no URL (defensive) and build clean rows
  const rows = newItems
    .filter((item) => !!item.link)
    .map((item) => ({
      url: item.link!,
      title: item.title || null,
      snippet: item.contentSnippet || null,
      source_category: item.sourceCategory,
      source_name: item.sourceName || null,
      pub_date: item.pubDate || null,
    }));

  if (!rows.length) {
    return { sourcesChecked: sources.length, itemsFound: allItems.length, itemsAfterKeywords: fresh.length, itemsAfterDedup: newItems.length, itemsQueued: 0, itemsSkipped: fresh.length, durationMs: Date.now() - start, debug: { sampleTitles, sampleAfterKeywords } };
  }

  // upsert with ignoreDuplicates — safe even if URL already exists (race condition)
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

  const { data: items } = await db
    .from("article_queue")
    .select("*")
    .eq("status", "pending")
    .order("queued_at")
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
      void attachPexelsImage(sanityId, article.slug as string, category);

      await db.from("processed_urls").insert({ url: item.url, slug: article.slug, title: en.title, category });
      await db.from("article_queue").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", item.id);

      const articleUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app"}/${category}/${article.slug}`;
      await sendTelegram(en.title, articleUrl, en.telegramText ?? "");

      details.push({ url: item.url, title: en.title, slug: article.slug as string, category, excerpt: en.excerpt, bodyPreview: (typeof en.body === "string" ? en.body : "").slice(0, 400), imageAttached: !!process.env.PEXELS_API_KEY, status: "published" });
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
