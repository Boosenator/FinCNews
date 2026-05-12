import type { MetadataRoute } from "next";
import { locales, categories } from "@/lib/i18n";
import { sanity } from "@/lib/sanity";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fincnews.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = sanity
    ? await sanity.fetch<{ slug: string; category: string; publishedAt?: string }[]>(
        `*[_type == "article"] { "slug": slug.current, category, publishedAt }`,
      )
    : [];

  const staticRoutes: MetadataRoute.Sitemap = [
    ...locales.map((locale) => ({
      url: `${BASE_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: 1,
    })),
    ...locales.flatMap((locale) =>
      categories.map((category) => ({
        url: `${BASE_URL}/${locale}/${category}`,
        lastModified: new Date(),
        changeFrequency: "hourly" as const,
        priority: 0.8,
      })),
    ),
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.flatMap((article) =>
    locales.map((locale) => ({
      url: `${BASE_URL}/${locale}/${article.category}/${article.slug}`,
      lastModified: article.publishedAt ? new Date(article.publishedAt) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );

  return [...staticRoutes, ...articleRoutes];
}
