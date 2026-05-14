import { NextResponse } from "next/server";
import { sanity } from "@/lib/sanity";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";

export async function GET() {
  const articles = sanity
    ? await sanity.fetch<{ slug: string; category: string; publishedAt: string; title: string; excerpt: string }[]>(
        `*[_type == "article" && defined(translations.en.title)] | order(publishedAt desc)[0...20] {
          "slug": slug.current,
          category,
          publishedAt,
          "title": translations.en.title,
          "excerpt": translations.en.excerpt
        }`,
        {},
        { next: { revalidate: 300 } },
      )
    : [];

  const items = articles
    .map((a) => {
      const url = `${BASE_URL}/${a.category}/${a.slug}`;
      return `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <description><![CDATA[${a.excerpt}]]></description>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
      <category>${a.category}</category>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>FinCNews — Finance &amp; Crypto Intelligence</title>
    <link>${BASE_URL}</link>
    <description>Fast AI-powered finance news: crypto, markets, macro, fintech.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
