import { createClient } from "@sanity/client";
import type { Category } from "@/lib/i18n";

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
  coverImage?: { url?: string; alt?: string };
  tags?: string[];
  telegraphUrl?: string;
  en: ArticleTranslation;
};

const projectId =
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? process.env.SANITY_PROJECT_ID;
const dataset =
  process.env.NEXT_PUBLIC_SANITY_DATASET ?? process.env.SANITY_DATASET ?? "production";

export const sanity = projectId
  ? createClient({
      projectId,
      dataset,
      apiVersion: "2024-01-01",
      useCdn: true,
    })
  : null;

const projection = `
  _id,
  "slug": slug.current,
  category,
  publishedAt,
  sourceUrl,
  tags,
  telegraphUrl,
  "coverImage": { "url": coverImage.asset->url, "alt": coverImage.alt },
  "en": translations.en
`;

export async function getArticles(category?: Category): Promise<Article[]> {
  if (!sanity) return [];
  const query = category
    ? `*[_type == "article" && category == $category && defined(translations.en.title)] | order(publishedAt desc)[0...24] {${projection}}`
    : `*[_type == "article" && defined(translations.en.title)] | order(publishedAt desc)[0...24] {${projection}}`;
  return sanity.fetch<Article[]>(query, { category }, { next: { revalidate: 60 } });
}

export async function getArticle(slug: string): Promise<Article | null> {
  if (!sanity) return null;
  return sanity.fetch<Article | null>(
    `*[_type == "article" && slug.current == $slug && defined(translations.en.title)][0] {${projection}}`,
    { slug },
    { next: { revalidate: 60 } },
  );
}

export async function getRelatedArticles(slug: string, category: Category): Promise<Article[]> {
  if (!sanity) return [];
  return sanity.fetch<Article[]>(
    `*[_type == "article" && category == $category && slug.current != $slug && defined(translations.en.title)] | order(publishedAt desc)[0...3] {${projection}}`,
    { category, slug },
    { next: { revalidate: 300 } },
  );
}

export async function findArticleByTopic(topic: string): Promise<{ slug: string; category: string } | null> {
  if (!sanity) return null;
  // Try exact title match first, then broad word match
  const words = topic.trim().split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return null;
  const pattern = words.join(" ");
  return sanity.fetch<{ slug: string; category: string } | null>(
    `*[_type == "article" && defined(translations.en.title) && (
      translations.en.title match $pattern
    )] | order(publishedAt desc)[0] { "slug": slug.current, category }`,
    { pattern },
    { next: { revalidate: 300 } },
  );
}

export function readingTime(body: PortableTextBlock[] | string | undefined): number {
  if (!body) return 1;
  const text =
    typeof body === "string"
      ? body
      : body.map((b) => b.children?.map((c) => c.text).join(" ") ?? "").join(" ");
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 200));
}

export function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
