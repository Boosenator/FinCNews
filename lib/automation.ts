import { supabaseAdmin } from "@/lib/supabase";

type FeedEntry = {
  title?: string;
  link?: string;
  pubDate?: string;
  contentSnippet?: string;
};

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

async function parseFeed(url: string): Promise<FeedEntry[]> {
  const res = await fetch(url, {
    headers: { "User-Agent": "FinCNews-Bot/1.0" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, 20).map((item) => ({
    title: extractTag(item, "title"),
    link: extractTag(item, "link") || extractTag(item, "guid"),
    pubDate: extractTag(item, "pubDate"),
    contentSnippet: extractTag(item, "description").replace(/<[^>]+>/g, " ").slice(0, 300),
  }));
}

const KEYWORDS = [
  "bitcoin","ethereum","solana","ETF","hack","exploit","listing","regulation",
  "ban","fork","upgrade","airdrop","stablecoin","CBDC","DeFi",
  "Fed","rate","CPI","inflation","recession","FOMC",
  "SEC","CFTC","MiCA","compliance",
  "earnings","IPO","merger","acquisition","bankruptcy",
  "payment","neobank","fintech",
];

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
    scores[cat] = kws.filter((kw) => lower.includes(kw.toLowerCase())).length;
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

export type AutomationResult = {
  articlesFound: number;
  articlesPublished: number;
  articlesSkipped: number;
  durationMs: number;
  details: Array<{ url: string; title?: string; slug?: string; status: "published" | "error" | "skipped"; error?: string }>;
};

export async function runAutomation(maxArticles = 3): Promise<AutomationResult> {
  const start = Date.now();
  const db = supabaseAdmin();

  const { data: sources } = await db.from("rss_sources").select("*").eq("enabled", true);
  if (!sources?.length) return { articlesFound: 0, articlesPublished: 0, articlesSkipped: 0, durationMs: Date.now() - start, details: [] };

  type FeedItem = { title?: string; link?: string; pubDate?: string; contentSnippet?: string; sourceCategory: string; sourceName: string };
  const allItems: FeedItem[] = [];

  for (const source of sources) {
    try {
      const entries = await parseFeed(source.url);
      for (const item of entries) {
        allItems.push({ ...item, sourceCategory: source.category, sourceName: source.name });
      }
      await db.from("rss_sources").update({ last_fetched_at: new Date().toISOString() }).eq("id", source.id);
    } catch {
      // source unreachable — skip silently
    }
  }

  // Filter: < 6h old and contains keywords
  const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
  const fresh = allItems.filter((item) => {
    if (!item.link || !item.title) return false;
    const age = new Date(item.pubDate ?? 0).getTime();
    if (age < sixHoursAgo && item.pubDate) return false;
    const text = `${item.title} ${item.contentSnippet ?? ""}`.toLowerCase();
    return KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
  });

  // Deduplicate
  const urls = fresh.map((i) => i.link!).filter(Boolean);
  const { data: existing } = await db.from("processed_urls").select("url").in("url", urls);
  const seen = new Set((existing ?? []).map((r: { url: string }) => r.url));
  const newItems = fresh.filter((i) => !seen.has(i.link!));

  const toProcess = newItems.slice(0, maxArticles);
  // skipped = already in processed_urls (deduped)
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

      await publishToSanity(article);

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

      details.push({ url: item.link!, title: en.title, slug: article.slug as string, status: "published" });
    } catch (e) {
      details.push({ url: item.link!, title: item.title, status: "error", error: String(e) });
    }
  }

  return {
    articlesFound: fresh.length,
    articlesPublished: details.filter((d) => d.status === "published").length,
    articlesSkipped: skipped,
    durationMs: Date.now() - start,
    details,
  };
}
