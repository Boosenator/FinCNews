import type { MetadataRoute } from "next";
import { categories } from "@/lib/i18n";
import { sanity } from "@/lib/sanity";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fincnews.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = sanity
    ? await sanity.fetch<{ slug: string; category: string; publishedAt?: string }[]>(
        `*[_type == "article" && defined(translations.en.title)] { "slug": slug.current, category, publishedAt }`,
      )
    : [];

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "hourly", priority: 1 },
    ...categories.map((cat) => ({
      url: `${BASE_URL}/${cat}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...articles.map((a) => ({
      url: `${BASE_URL}/${a.category}/${a.slug}`,
      lastModified: a.publishedAt ? new Date(a.publishedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
