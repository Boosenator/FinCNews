import type { MetadataRoute } from "next";
import { categories } from "@/lib/i18n";
import { sanity } from "@/lib/sanity";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";

function dateStr(iso?: string): string {
  return new Date(iso ?? Date.now()).toISOString().split("T")[0]; // YYYY-MM-DD
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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
  const latestOverall = articles[0]?.publishedAt;

  return [
    { url: BASE_URL, lastModified: dateStr(latestOverall) },

    ...categories.map((cat) => ({
      url: `${BASE_URL}/${cat}`,
      lastModified: dateStr(latestPerCategory[cat] ?? latestOverall),
    })),

    ...articles.map((a) => ({
      url: `${BASE_URL}/${a.category}/${a.slug}`,
      lastModified: dateStr(a.publishedAt),
    })),
  ];
}
