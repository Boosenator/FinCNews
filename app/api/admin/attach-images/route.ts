import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";
import { isAuthedOrN8n } from "@/lib/auth";

export const maxDuration = 120;

const VISUAL_FALLBACK: Record<string, string> = {
  crypto:    "trading screens financial data analysts office",
  markets:   "stock exchange trading floor multiple screens",
  economy:   "central bank marble building exterior washington",
  fintech:   "mobile payment smartphone hand technology",
  policy:    "government hearing room officials testifying",
  companies: "corporate boardroom meeting executives office",
};

type ArticleRow = {
  _id: string;
  slug: string;
  category: string;
  title: string | null;
};

async function buildQuery(category: string, title?: string): Promise<string> {
  const context = [title, category].filter(Boolean).join(" | ");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 25,
        messages: [{
          role: "user",
          content: `You are a photo editor choosing a Reuters/Bloomberg editorial stock photo for a financial news article.

Article: ${context}

Output ONLY 4-6 words describing a real photojournalistic scene. No Bitcoin coins, no crypto logos, no physical tokens, no brand logos. Focus on people, environments, and actions.

Examples:
"SEC sues crypto exchange" → "government lawyers courtroom hearing officials"
"Bitcoin ETF approved" → "stock exchange trading floor analysts screens"
"Fed raises interest rates" → "federal reserve building washington exterior"
"DeFi protocol hacked" → "cybersecurity analyst dark server room"
"Solana price surges" → "traders watching screens financial charts"

Only the query, nothing else.`,
        }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const query = (data.content?.[0]?.text ?? "").trim().replace(/["']/g, "").slice(0, 80);
      if (query.length > 5) return query;
    }
  } catch {
    // fall through to static fallback
  }

  return VISUAL_FALLBACK[category] ?? "financial office trading screens analysts";
}

async function fetchPexelsImage(query: string, pexelsKey: string): Promise<Buffer | null> {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`,
      { headers: { Authorization: pexelsKey }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const { photos } = await res.json();

    // Pick a random photo from top 10 to avoid same image on every article
    const idx = Math.floor(Math.random() * Math.min(photos?.length ?? 0, 10));
    const photoUrl: string = photos?.[idx]?.src?.large2x;
    if (!photoUrl) return null;

    const imgRes = await fetch(photoUrl, { signal: AbortSignal.timeout(10000) });
    if (!imgRes.ok) return null;
    return Buffer.from(await imgRes.arrayBuffer());
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthedOrN8n(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return NextResponse.json({ error: "PEXELS_API_KEY not configured" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  // replace=true → process articles that already have a cover image
  const replace = searchParams.get("replace") === "true";
  // category=crypto → filter to one category
  const categoryFilter = searchParams.get("category") ?? null;
  // limit/offset for pagination (max 20 per call to stay within Vercel timeout)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 20);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN!,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  const coverFilter = replace ? "" : "&& !defined(coverImage.asset)";
  const catFilter = categoryFilter ? `&& category == "${categoryFilter}"` : "";
  const articles: ArticleRow[] = await sanity.fetch(
    `*[_type == "article" ${coverFilter} ${catFilter}] | order(publishedAt desc)[${offset}...${offset + limit}] {
      _id,
      "slug": slug.current,
      category,
      "title": translations.en.title
    }`,
  );

  if (!articles.length) {
    return NextResponse.json({ found: 0, attached: 0, errors: 0, results: [], offset, limit });
  }

  // Generate all AI visual queries in parallel to save time
  const queries = await Promise.all(
    articles.map((a) => buildQuery(a.category, a.title ?? undefined)),
  );

  const results: Array<{ id: string; title: string; query: string; status: "ok" | "error"; error?: string }> = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const imageQuery = queries[i];
    try {
      const buffer = await fetchPexelsImage(imageQuery, pexelsKey);
      if (!buffer) throw new Error("Pexels returned no image");

      const asset = await sanity.assets.upload("image", buffer, {
        filename: `${article.slug}.jpg`,
        contentType: "image/jpeg",
      });

      await sanity.patch(article._id).set({
        coverImage: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
      }).commit();

      results.push({ id: article._id, title: article.title ?? article.slug, query: imageQuery, status: "ok" });
    } catch (e) {
      results.push({ id: article._id, title: article.title ?? article.slug, query: imageQuery, status: "error", error: String(e) });
    }
  }

  return NextResponse.json({
    found: articles.length,
    attached: results.filter((r) => r.status === "ok").length,
    errors: results.filter((r) => r.status === "error").length,
    offset,
    limit,
    nextOffset: offset + limit,
    results,
  });
}
