import type { MetadataRoute } from "next";
import { categories } from "@/lib/i18n";
import { sanity } from "@/lib/sanity";

import { BASE_URL } from "@/lib/config";

const CATEGORY_PAGE_SIZE = 24;

function dateStr(iso?: string): string {
  return new Date(iso ?? Date.now()).toISOString().split("T")[0]; // YYYY-MM-DD
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, topicHubs] = sanity
    ? await Promise.all([
      sanity.fetch<{ slug: string; category: string; publishedAt?: string }[]>(
        `*[_type == "article" && defined(translations.en.title)] | order(publishedAt desc) {
          "slug": slug.current, category, publishedAt
        }`,
        {},
        { next: { revalidate: 300 } },
      ),
      sanity.fetch<{ slug: string; updatedAt?: string }[]>(
        `*[_type == "topicHub" && defined(slug.current)] | order(updatedAt desc) {
          "slug": slug.current,
          updatedAt
        }`,
        {},
        { next: { revalidate: 300 } },
      ),
    ])
    : [[], []];

  const latestPerCategory: Record<string, string> = {};
  for (const a of articles) {
    if (a.publishedAt && !latestPerCategory[a.category]) {
      latestPerCategory[a.category] = a.publishedAt;
    }
  }
  const latestOverall = articles[0]?.publishedAt;
  const categoryArchivePages = categories.flatMap((cat) => {
    const total = articles.filter((a) => a.category === cat).length;
    const pages = Math.ceil(total / CATEGORY_PAGE_SIZE);
    return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({
      page: i + 2,
      category: cat,
      lastModified: latestPerCategory[cat] ?? latestOverall,
    }));
  });

  return [
    { url: BASE_URL, lastModified: dateStr(latestOverall) },
    { url: `${BASE_URL}/topics`, lastModified: dateStr(topicHubs[0]?.updatedAt ?? latestOverall) },

    ...categories.map((cat) => ({
      url: `${BASE_URL}/${cat}`,
      lastModified: dateStr(latestPerCategory[cat] ?? latestOverall),
    })),

    ...topicHubs.map((hub) => ({
      url: `${BASE_URL}/topics/${hub.slug}`,
      lastModified: dateStr(hub.updatedAt ?? latestOverall),
    })),

    ...categoryArchivePages.map((p) => ({
      url: `${BASE_URL}/${p.category}/page/${p.page}`,
      lastModified: dateStr(p.lastModified),
    })),

    ...articles.map((a) => ({
      url: `${BASE_URL}/${a.category}/${a.slug}`,
      lastModified: dateStr(a.publishedAt),
    })),
  ];
}
