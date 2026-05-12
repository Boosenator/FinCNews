import { createClient } from "@sanity/client";
import { NextRequest, NextResponse } from "next/server";
import { categories, locales } from "@/lib/i18n";
import type { PortableTextBlock } from "@/lib/sanity";

type IncomingArticle = {
  slug?: string | { current?: string };
  category?: string;
  publishedAt?: string;
  sourceUrl?: string;
  coverImage?: unknown;
  tags?: string[];
  translations?: Record<
    string,
    {
      title?: string;
      excerpt?: string;
      body?: string | PortableTextBlock[];
      metaTitle?: string;
      metaDescription?: string;
      telegramText?: string;
    }
  >;
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
  const validationError = validateArticle(article);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID,
    dataset: process.env.SANITY_DATASET ?? "production",
    token: process.env.SANITY_TOKEN,
    apiVersion: "2024-01-01",
    useCdn: false,
  });

  const doc = await sanity.create({
    _type: "article",
    ...article,
    slug: {
      _type: "slug",
      current: typeof article.slug === "string" ? article.slug : article.slug?.current,
    },
    category: article.category,
    translations: normalizeTranslations(article.translations ?? {}),
    publishedAt: article.publishedAt ?? new Date().toISOString(),
  });

  return NextResponse.json({ success: true, id: doc._id });
}

function validateArticle(article: IncomingArticle) {
  const slug = typeof article.slug === "string" ? article.slug : article.slug?.current;

  if (!slug) {
    return "Missing slug";
  }

  if (!article.category || !categories.includes(article.category as never)) {
    return "Invalid category";
  }

  if (!article.translations) {
    return "Missing translations";
  }

  for (const locale of locales) {
    const translation = article.translations[locale];

    if (!translation?.title || !translation.excerpt || !translation.body) {
      return `Missing required translation fields for ${locale}`;
    }
  }

  return null;
}

function normalizeTranslations(translations: NonNullable<IncomingArticle["translations"]>) {
  return Object.fromEntries(
    locales.map((locale) => {
      const translation = translations[locale];

      return [
        locale,
        {
          ...translation,
          body: normalizeBody(translation?.body),
        },
      ];
    }),
  );
}

function normalizeBody(body: string | PortableTextBlock[] | undefined): PortableTextBlock[] {
  if (Array.isArray(body)) {
    return body;
  }

  if (!body) {
    return [];
  }

  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => ({
      _type: "block",
      _key: `paragraph-${index}`,
      style: "normal",
      markDefs: [],
      children: [
        {
          _type: "span",
          _key: `paragraph-${index}-span`,
          text: paragraph,
          marks: [],
        },
      ],
    }));
}
