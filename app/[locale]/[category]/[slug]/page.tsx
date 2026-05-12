import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import { getArticle, type PortableTextBlock } from "@/lib/sanity";
import { isCategory, isLocale, type Locale } from "@/lib/i18n";

type ArticlePageProps = {
  params: {
    locale: string;
    category: string;
    slug: string;
  };
};

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) {
    return {};
  }

  const article = await getArticle(params.slug, params.locale);
  const t = article?.translations[params.locale];

  if (!article || !t) {
    return {};
  }

  return {
    title: t.metaTitle ?? t.title,
    description: t.metaDescription ?? t.excerpt,
    alternates: {
      canonical: `/${params.locale}/${params.category}/${params.slug}`,
      languages: {
        uk: `/ua/${params.category}/${params.slug}`,
        en: `/en/${params.category}/${params.slug}`,
        ru: `/ru/${params.category}/${params.slug}`,
        pl: `/pl/${params.category}/${params.slug}`,
      },
    },
    openGraph: {
      title: t.metaTitle ?? t.title,
      description: t.metaDescription ?? t.excerpt,
      images: article.coverImage?.url ? [article.coverImage.url] : [],
      type: "article",
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  if (!isLocale(params.locale) || !isCategory(params.category)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const article = await getArticle(params.slug, locale);

  if (!article || article.category !== params.category) {
    notFound();
  }

  const t = article.translations[locale];

  if (!t) {
    notFound();
  }

  const body = normalizeBody(t.body);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <article>
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
          {article.category}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-zinc-300">{t.excerpt}</p>
        {article.coverImage?.url ? (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg bg-zinc-900">
            <Image
              src={article.coverImage.url}
              alt={article.coverImage.alt ?? t.title}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 768px) 768px, 100vw"
            />
          </div>
        ) : null}
        <div className="prose prose-invert prose-zinc mt-8 max-w-none prose-headings:text-white prose-a:text-cyan-300">
          {body.length > 0 ? <PortableText value={body} /> : null}
        </div>
      </article>
    </main>
  );
}

function normalizeBody(body: PortableTextBlock[] | string | undefined): PortableTextBlock[] {
  if (Array.isArray(body)) {
    return body;
  }

  if (!body) {
    return [];
  }

  return body
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      _type: "block",
      _key: `body-${index}`,
      style: "normal",
      markDefs: [],
      children: [
        {
          _type: "span",
          _key: `body-${index}-span`,
          text,
          marks: [],
        },
      ],
    }));
}
