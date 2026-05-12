import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import Breadcrumbs from "@/components/Breadcrumbs";
import ShareButtons from "@/components/ShareButtons";
import ArticleCard from "@/components/ArticleCard";
import TelegramCTA from "@/components/TelegramCTA";
import { getArticle, getRelatedArticles, readingTime, type PortableTextBlock } from "@/lib/sanity";
import { getMessages, isCategory, isLocale, type Locale } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fincnews.com";

type ArticlePageProps = {
  params: { locale: string; category: string; slug: string };
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};

  const article = await getArticle(params.slug, params.locale as Locale);
  const t = article?.translations[params.locale as Locale];
  if (!article || !t) return {};

  return {
    title: t.metaTitle ?? t.title,
    description: t.metaDescription ?? t.excerpt,
    alternates: {
      canonical: `/${params.locale}/${params.category}/${params.slug}`,
      languages: {
        en: `/en/${params.category}/${params.slug}`,
        uk: `/ua/${params.category}/${params.slug}`,
        ru: `/ru/${params.category}/${params.slug}`,
        pl: `/pl/${params.category}/${params.slug}`,
      },
    },
    openGraph: {
      title: t.metaTitle ?? t.title,
      description: t.metaDescription ?? t.excerpt,
      images: article.coverImage?.url ? [{ url: article.coverImage.url }] : [],
      type: "article",
      publishedTime: article.publishedAt,
      section: params.category,
      tags: article.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: t.metaTitle ?? t.title,
      description: t.metaDescription ?? t.excerpt,
      images: article.coverImage?.url ? [article.coverImage.url] : [],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  if (!isLocale(params.locale) || !isCategory(params.category)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const [article, messages] = await Promise.all([
    getArticle(params.slug, locale),
    getMessages(locale),
  ]);

  if (!article || article.category !== params.category) {
    notFound();
  }

  const t = article.translations[locale];
  if (!t) notFound();

  const body = normalizeBody(t.body);
  const mins = readingTime(t.body);
  const articleUrl = `${BASE_URL}/${locale}/${params.category}/${params.slug}`;

  const related = await getRelatedArticles(params.slug, article.category, locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: t.metaTitle ?? t.title,
    description: t.metaDescription ?? t.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: { "@type": "Organization", name: "FinCNews Editorial", url: BASE_URL },
    publisher: {
      "@type": "Organization",
      name: "FinCNews",
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.png` },
    },
    image: article.coverImage?.url ? [article.coverImage.url] : undefined,
    url: articleUrl,
    articleSection: params.category,
    keywords: article.tags?.join(", "),
    inLanguage: locale,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Breadcrumbs */}
        <div className="mb-6">
          <Breadcrumbs
            crumbs={[
              { label: "Home", href: `/${locale}` },
              {
                label: messages.categories[article.category] ?? article.category,
                href: `/${locale}/${article.category}`,
              },
              { label: t.title },
            ]}
          />
        </div>

        <article>
          {/* Category + meta */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href={`/${locale}/${article.category}`}
              className="rounded bg-cyan-400/10 px-2 py-0.5 font-semibold uppercase tracking-wider text-cyan-400 transition hover:bg-cyan-400/20"
            >
              {messages.categories[article.category] ?? article.category}
            </Link>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-500">{mins} {messages.article.readTime}</span>
            {article.publishedAt && (
              <>
                <span className="text-zinc-600">·</span>
                <time className="text-zinc-500" dateTime={article.publishedAt}>
                  {dateFormatter.format(new Date(article.publishedAt))}
                </time>
              </>
            )}
          </div>

          {/* Title */}
          <h1 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            {t.title}
          </h1>

          {/* Excerpt */}
          <p className="mt-4 text-lg leading-8 text-zinc-300">{t.excerpt}</p>

          {/* Byline + share */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-white/8 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-bold text-cyan-400">
                FC
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">{messages.article.by}</p>
                {article.sourceUrl && (
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="text-xs text-zinc-500 underline underline-offset-2 transition hover:text-zinc-300"
                  >
                    {messages.article.source}
                  </a>
                )}
              </div>
            </div>
            <ShareButtons url={articleUrl} title={t.title} />
          </div>

          {/* Cover image */}
          {article.coverImage?.url && (
            <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-xl bg-zinc-900">
              <Image
                src={article.coverImage.url}
                alt={article.coverImage.alt ?? t.title}
                fill
                priority
                className="object-cover"
                sizes="(min-width: 768px) 768px, 100vw"
              />
            </div>
          )}

          {/* Body */}
          <div className="prose prose-invert prose-zinc mt-8 max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-zinc-100 prose-blockquote:border-cyan-400 prose-blockquote:text-zinc-300">
            {body.length > 0 && <PortableText value={body} />}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {messages.article.tags}:
              </span>
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Bottom share */}
          <div className="mt-8 rounded-xl border border-white/8 bg-white/[0.02] p-5">
            <p className="mb-3 text-sm font-medium text-zinc-300">
              Found this useful? {messages.article.share}:
            </p>
            <ShareButtons url={articleUrl} title={t.title} />
          </div>
        </article>

        {/* Telegram CTA */}
        <div className="mt-8">
          <TelegramCTA
            title="Get finance alerts on Telegram"
            text="Breaking market news, crypto analysis and trade ideas — before the crowd. Subscribe free."
          />
        </div>

        {/* Related articles */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-5 text-lg font-black tracking-tight text-white">
              {messages.article.related}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((article) => (
                <ArticleCard key={article._id} article={article} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function normalizeBody(body: PortableTextBlock[] | string | undefined): PortableTextBlock[] {
  if (Array.isArray(body)) return body;
  if (!body) return [];

  return body
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({
      _type: "block" as const,
      _key: `b-${i}`,
      style: "normal",
      markDefs: [],
      children: [{ _type: "span" as const, _key: `s-${i}`, text, marks: [] }],
    }));
}
