import { NextResponse } from "next/server";
import { sanity } from "@/lib/sanity";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fincnews.com";

type FeedArticle = {
  slug: string;
  category: string;
  publishedAt: string;
  translations: { en?: { title: string; excerpt: string } };
};

export async function GET() {
  const articles: FeedArticle[] = sanity
    ? await sanity.fetch(
        `*[_type == "article" && defined(translations.en.title)] | order(publishedAt desc)[0...20] {
          "slug": slug.current,
          category,
          publishedAt,
          "translations": { "en": { "title": translations.en.title, "excerpt": translations.en.excerpt } }
        }`,
        {},
        { next: { revalidate: 300 } },
      )
    : [];

  const items = articles
    .map((article) => {
      const t = article.translations.en;
      if (!t) return "";
      const url = `${BASE_URL}/en/${article.category}/${article.slug}`;
      return `
    <item>
      <title><![CDATA[${t.title}]]></title>
      <description><![CDATA[${t.excerpt}]]></description>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <category>${article.category}</category>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>FinCNews — Finance &amp; Crypto Intelligence</title>
    <link>${BASE_URL}/en</link>
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
