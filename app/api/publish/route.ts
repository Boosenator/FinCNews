import { createClient } from "@sanity/client";
import { NextRequest, NextResponse } from "next/server";
import { isCategory } from "@/lib/i18n";
import type { PortableTextBlock } from "@/lib/sanity";

type IncomingArticle = {
  slug?: string | { current?: string };
  category?: string;
  publishedAt?: string;
  sourceUrl?: string;
  coverImage?: unknown;
  tags?: string[];
  translations?: {
    en?: {
      title?: string;
      excerpt?: string;
      body?: string | PortableTextBlock[];
      metaTitle?: string;
      metaDescription?: string;
      telegramText?: string;
    };
  };
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");

  if (!process.env.N8N_SECRET || authHeader !== `Bearer ${process.env.N8N_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.SANITY_PROJECT_ID || !process.env.SANITY_TOKEN) {
    return NextResponse.json({ error: "Sanity is not configured" }, { status: 500 });
  }

  const article = (await req.json()) as IncomingArticle;
  const error = validate(article);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  const en = article.translations!.en!;

  const doc = await sanity.create({
    _type: "article",
    slug: {
      _type: "slug",
      current: typeof article.slug === "string" ? article.slug : article.slug?.current,
    },
    category: article.category,
    publishedAt: article.publishedAt ?? new Date().toISOString(),
    sourceUrl: article.sourceUrl,
    coverImage: article.coverImage,
    tags: article.tags,
    translations: {
      en: {
        ...en,
        body: normalizeBody(en.body),
      },
    },
  });

  return NextResponse.json({ success: true, id: doc._id });
}

function validate(article: IncomingArticle): string | null {
  const slug = typeof article.slug === "string" ? article.slug : article.slug?.current;
  if (!slug) return "Missing slug";
  if (!article.category || !isCategory(article.category)) return "Invalid category";
  const en = article.translations?.en;
  if (!en?.title || !en.excerpt || !en.body) return "Missing translations.en fields";
  return null;
}

function normalizeBody(body: string | PortableTextBlock[] | undefined): PortableTextBlock[] {
  if (Array.isArray(body)) return body;
  if (!body) return [];
  return body
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({
      _type: "block" as const,
      _key: `p-${i}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span" as const, _key: `s-${i}`, text, marks: [] }],
    }));
}
