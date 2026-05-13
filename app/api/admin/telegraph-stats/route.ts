import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@sanity/client";

export const maxDuration = 60;

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

type SanityArticle = {
  _id: string;
  slug: string;
  category: string;
  telegraphUrl: string;
  title: string;
  publishedAt?: string;
};

type TelegraphStat = {
  slug: string;
  category: string;
  title: string;
  telegraphUrl: string;
  telegraphPath: string;
  views: number;
  publishedAt?: string;
};

async function fetchViews(path: string): Promise<number> {
  try {
    const res = await fetch(
      `https://api.telegra.ph/getPage?path=${encodeURIComponent(path)}&return_content=false`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.result?.views ?? 0;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID ?? process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN!,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  const articles: SanityArticle[] = await sanity.fetch(
    `*[_type == "article" && defined(telegraphUrl)] | order(publishedAt desc)[0...100] {
      _id,
      "slug": slug.current,
      category,
      telegraphUrl,
      publishedAt,
      "title": translations.en.title
    }`,
  );

  if (!articles.length) {
    return NextResponse.json({ stats: [], totalViews: 0 });
  }

  // Fetch views in parallel with concurrency limit of 10
  const results: TelegraphStat[] = [];
  const BATCH = 10;

  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH);
    const batchResults = await Promise.all(
      batch.map(async (article) => {
        // Extract path from URL: https://telegra.ph/Slug-05-13 → Slug-05-13
        const path = article.telegraphUrl.replace("https://telegra.ph/", "").split("?")[0];
        const views = await fetchViews(path);
        return {
          slug: article.slug,
          category: article.category,
          title: article.title ?? article.slug,
          telegraphUrl: article.telegraphUrl,
          telegraphPath: path,
          views,
          publishedAt: article.publishedAt,
        } as TelegraphStat;
      }),
    );
    results.push(...batchResults);
  }

  // Sort by views desc, take top 25
  const top25 = results
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);

  const totalViews = results.reduce((sum, r) => sum + r.views, 0);

  return NextResponse.json({
    stats: top25,
    totalViews,
    totalArticles: articles.length,
  });
}
