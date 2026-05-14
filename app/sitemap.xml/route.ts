import { NextResponse } from "next/server";
import { categories } from "@/lib/i18n";
import { sanity } from "@/lib/sanity";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";

function toDate(iso?: string): string {
  return (iso ?? new Date().toISOString()).slice(0, 10); // YYYY-MM-DD
}

function url(loc: string, lastmod: string) {
  return `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
}

export async function GET() {
  const articles = sanity
    ? await sanity.fetch<{ slug: string; category: string; publishedAt?: string }[]>(
        `*[_type == "article" && defined(translations.en.title)] | order(publishedAt desc) {
          "slug": slug.current, category, publishedAt
        }`,
        {},
        { next: { revalidate: 300 } },
      )
    : [];

  const latestPerCategory: Record<string, string> = {};
  for (const a of articles) {
    if (a.publishedAt && !latestPerCategory[a.category]) {
      latestPerCategory[a.category] = a.publishedAt;
    }
  }
  const latestOverall = articles[0]?.publishedAt ?? new Date().toISOString();

  const rows = [
    url(BASE_URL, toDate(latestOverall)),
    ...categories.map((cat) => url(`${BASE_URL}/${cat}`, toDate(latestPerCategory[cat] ?? latestOverall))),
    ...articles.map((a) => url(`${BASE_URL}/${a.category}/${a.slug}`, toDate(a.publishedAt))),
  ].join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
