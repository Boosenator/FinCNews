import type { MetadataRoute } from "next";
import { categories } from "@/lib/i18n";
import { sanity } from "@/lib/sanity";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";

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

  // Latest publishedAt per category — used for category page lastModified
  const latestPerCategory: Record<string, Date> = {};
  for (const a of articles) {
    if (a.publishedAt && !latestPerCategory[a.category]) {
      latestPerCategory[a.category] = new Date(a.publishedAt);
    }
  }
  const latestOverall = articles[0]?.publishedAt ? new Date(articles[0].publishedAt) : new Date();

  return [
    // Homepage — lastModified = date of newest article
    { url: BASE_URL, lastModified: latestOverall },

    // Category pages — lastModified = newest article in that category
    ...categories.map((cat) => ({
      url: `${BASE_URL}/${cat}`,
      lastModified: latestPerCategory[cat] ?? latestOverall,
    })),

    // Articles — lastModified = actual publishedAt
    ...articles.map((a) => ({
      url: `${BASE_URL}/${a.category}/${a.slug}`,
      lastModified: a.publishedAt ? new Date(a.publishedAt) : latestOverall,
    })),
  ];
}
