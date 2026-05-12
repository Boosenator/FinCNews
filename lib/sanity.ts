import { createClient } from "@sanity/client";
import type { Category, Locale } from "@/lib/i18n";

export type ArticleTranslation = {
  title: string;
  excerpt: string;
  body?: PortableTextBlock[] | string;
  metaTitle?: string;
  metaDescription?: string;
  telegramText?: string;
};

export type PortableTextBlock = {
  _type: "block";
  _key?: string;
  style?: string;
  children?: Array<{
    _type: "span";
    _key?: string;
    text: string;
    marks?: string[];
  }>;
  markDefs?: unknown[];
};

export type Article = {
  _id: string;
  slug: string;
  category: Category;
  publishedAt?: string;
  sourceUrl?: string;
  coverImage?: {
    url?: string;
    alt?: string;
  };
  tags?: string[];
  translations: Partial<Record<Locale, ArticleTranslation>>;
};

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET ?? "production";

export const sanity = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2024-01-01",
      useCdn: true,
    })
  : null;

const articleProjection = `
  _id,
  "slug": slug.current,
  category,
  publishedAt,
  sourceUrl,
  tags,
  "coverImage": {
    "url": coverImage.asset->url,
    "alt": coverImage.alt
  },
  translations
`;

export async function getArticles(locale: Locale, category?: Category) {
  if (!sanity) {
    return [];
  }

  const query = category
    ? `*[_type == "article" && category == $category && defined(translations[$locale].title)] | order(publishedAt desc)[0...24] {${articleProjection}}`
    : `*[_type == "article" && defined(translations[$locale].title)] | order(publishedAt desc)[0...24] {${articleProjection}}`;

  return sanity.fetch<Article[]>(
    query,
    { locale, category },
    { next: { revalidate: 60 } },
  );
}

export async function getArticle(slug: string, locale: Locale) {
  if (!sanity) {
    return null;
  }

  return sanity.fetch<Article | null>(
    `*[_type == "article" && slug.current == $slug && defined(translations[$locale].title)][0] {${articleProjection}}`,
    { slug, locale },
    { next: { revalidate: 60 } },
  );
}
