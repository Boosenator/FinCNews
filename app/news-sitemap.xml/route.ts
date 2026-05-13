import { NextResponse } from "next/server";
import { sanity } from "@/lib/sanity";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";

// Google News sitemap — last 2 days only, required for Google News inclusion
export async function GET() {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const articles = sanity
    ? await sanity.fetch<{ slug: string; category: string; publishedAt: string; title: string }[]>(
        `*[_type == "article" && defined(translations.en.title) && publishedAt >= $cutoff] | order(publishedAt desc)[0...1000] {
          "slug": slug.current,
          category,
          publishedAt,
          "title": translations.en.title
        }`,
        { cutoff: twoDaysAgo },
        { next: { revalidate: 300 } },
      )
    : [];

  const items = articles
    .map(
      (a) => `
    <url>
      <loc>${BASE_URL}/${a.category}/${a.slug}</loc>
      <news:news>
        <news:publication>
          <news:name>FinCNews</news:name>
          <news:language>en</news:language>
        </news:publication>
        <news:publication_date>${new Date(a.publishedAt).toISOString()}</news:publication_date>
        <news:title>${a.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</news:title>
      </news:news>
    </url>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
  ${items}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
