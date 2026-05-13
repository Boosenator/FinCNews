import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";

export const maxDuration = 120;

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

const CATEGORY_QUERIES: Record<string, string> = {
  crypto:    "bitcoin cryptocurrency blockchain",
  markets:   "stock market trading finance",
  economy:   "federal reserve central bank economy",
  fintech:   "mobile payment fintech technology",
  policy:    "law regulation government finance",
  companies: "corporate office business earnings",
};

type ArticleRow = {
  _id: string;
  slug: string;
  category: string;
  title: string;
};

async function fetchPexelsImage(category: string, pexelsKey: string): Promise<Buffer | null> {
  const query = CATEGORY_QUERIES[category] ?? "finance business";
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
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
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return NextResponse.json({ error: "PEXELS_API_KEY not configured" }, { status: 500 });

  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN!,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  // Find articles without a cover image
  const articles: ArticleRow[] = await sanity.fetch(
    `*[_type == "article" && !defined(coverImage.asset)] | order(publishedAt desc)[0...30] {
      _id,
      "slug": slug.current,
      category,
      "title": translations.en.title
    }`,
  );

  if (!articles.length) {
    return NextResponse.json({ found: 0, attached: 0, errors: 0, results: [] });
  }

  const results: Array<{ id: string; title: string; status: "ok" | "error"; error?: string }> = [];

  for (const article of articles) {
    try {
      const buffer = await fetchPexelsImage(article.category, pexelsKey);
      if (!buffer) throw new Error("Pexels returned no image");

      const asset = await sanity.assets.upload("image", buffer, {
        filename: `${article.slug}.jpg`,
        contentType: "image/jpeg",
      });

      await sanity.patch(article._id).set({
        coverImage: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
      }).commit();

      results.push({ id: article._id, title: article.title ?? article.slug, status: "ok" });
    } catch (e) {
      results.push({ id: article._id, title: article.title ?? article.slug, status: "error", error: String(e) });
    }
  }

  return NextResponse.json({
    found: articles.length,
    attached: results.filter((r) => r.status === "ok").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  });
}
