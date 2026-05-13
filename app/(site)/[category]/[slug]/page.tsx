import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import Breadcrumbs from "@/components/Breadcrumbs";
import ShareButtons from "@/components/ShareButtons";
import ArticleCard from "@/components/ArticleCard";
import TelegramCTA from "@/components/TelegramCTA";
import { getArticle, getRelatedArticles, readingTime, timeAgo, type PortableTextBlock } from "@/lib/sanity";
import { isCategory, categoryLabels, type Category } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fincnews.com";

type Props = { params: { category: string; slug: string } };

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isCategory(params.category)) return {};
  const article = await getArticle(params.slug);
  const t = article?.en;
  if (!article || !t) return {};

  return {
    title: t.metaTitle ?? t.title,
    description: t.metaDescription ?? t.excerpt,
    alternates: {
      canonical: `/${params.category}/${params.slug}`,
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

export default async function ArticlePage({ params }: Props) {
  if (!isCategory(params.category)) notFound();

  const article = await getArticle(params.slug);

  if (!article || article.category !== params.category) notFound();

  const t = article.en;
  if (!t) notFound();

  const body = normalizeBody(t.body);
  const mins = readingTime(t.body);
  const ago = timeAgo(article.publishedAt);
  const articleUrl = `${BASE_URL}/${params.category}/${params.slug}`;
  const label = categoryLabels[article.category as Category] ?? article.category;

  const related = await getRelatedArticles(params.slug, article.category);

  // NewsArticle — fully compliant with Google's guidelines
  const newsArticleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: t.metaTitle ?? t.title,
    description: t.metaDescription ?? t.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.publishedAt,
    author: {
      "@type": "Organization",
      name: "FinCNews Editorial",
      url: `${BASE_URL}/about`,
    },
    publisher: {
      "@type": "Organization",
      name: "FinCNews",
      url: BASE_URL,
      logo: { "@type": "ImageObject", url: `${BASE_URL}/logo.jpg`, width: 300, height: 77 },
    },
    // ImageObject format — required by Google News
    image: article.coverImage?.url
      ? [{ "@type": "ImageObject", url: article.coverImage.url, width: 1200, height: 630 }]
      : [{ "@type": "ImageObject", url: `${BASE_URL}/opengraph-image`, width: 1200, height: 630 }],
    url: articleUrl,
    mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl },
    articleSection: label,
    keywords: article.tags?.join(", "),
    inLanguage: "en-US",
  };

  // BreadcrumbList — shows in SERP as "Home › Category › Title"
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: label, item: `${BASE_URL}/${params.category}` },
      { "@type": "ListItem", position: 3, name: t.title, item: articleUrl },
    ],
  };

  // Speakable — marks headline + excerpt for voice search & AI Overviews citations
  const speakableSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".article-excerpt"],
    },
    url: articleUrl,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableSchema) }} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
          {/* Article */}
          <article>
            <Breadcrumbs
              crumbs={[
                { label: "Home", href: "/" },
                { label, href: `/${params.category}` },
                { label: t.title },
              ]}
            />

            {/* Meta */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <Link
                href={`/${params.category}`}
                className="rounded bg-cyan-400/10 px-2.5 py-1 font-bold uppercase tracking-wider text-cyan-400 transition hover:bg-cyan-400/20"
              >
                {label}
              </Link>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">{mins} min read</span>
              {article.publishedAt && (
                <>
                  <span className="text-zinc-700">·</span>
                  <time className="text-zinc-500" dateTime={article.publishedAt}>
                    {dateFormatter.format(new Date(article.publishedAt))}
                  </time>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-600">{ago}</span>
                </>
              )}
            </div>

            {/* Title */}
            <h1 className="mt-4 text-balance text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
              {t.title}
            </h1>

            {/* Excerpt */}
            <p className="article-excerpt mt-4 text-lg leading-8 text-zinc-300">{t.excerpt}</p>

            {/* Byline + share */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-y border-white/[0.06] py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10 text-xs font-black text-cyan-400">
                  FC
                </div>
                <div className="text-sm">
                  <p className="font-semibold text-zinc-200">FinCNews Editorial</p>
                  {article.sourceUrl && (
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="text-xs text-zinc-600 underline underline-offset-2 transition hover:text-zinc-400"
                    >
                      View source
                    </a>
                  )}
                  {article.telegraphUrl && (
                    <a href={article.telegraphUrl} target="_blank" rel="noreferrer"
                      className="text-[10px] text-zinc-600 underline underline-offset-2 transition hover:text-zinc-400">
                      Also on Telegraph
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
                  sizes="(min-width: 1024px) 700px, 100vw"
                />
              </div>
            )}

            {/* Body */}
            <div className="prose prose-invert prose-zinc mt-8 max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-zinc-100 prose-blockquote:border-l-cyan-400 prose-blockquote:text-zinc-300 prose-code:text-cyan-300">
              {body.length > 0 && <PortableText value={body} />}
            </div>

            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-600">Topics:</span>
                {article.tags.map((tag) => (
                  <span key={tag} className="rounded-md border border-white/[0.06] px-2.5 py-1 text-xs text-zinc-500">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Bottom share */}
            <div className="mt-8 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
              <p className="mb-3 text-sm font-semibold text-zinc-300">Share this story</p>
              <ShareButtons url={articleUrl} title={t.title} />
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-5">
            <TelegramCTA />

            {related.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
                <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Related</h2>
                <div className="divide-y divide-white/[0.04]">
                  {related.map((rel) => (
                    <ArticleCard key={rel._id} article={rel} size="compact" />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
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
