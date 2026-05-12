import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/sanity";
import { readingTime } from "@/lib/sanity";
import type { Locale } from "@/lib/i18n";

type ArticleHeroProps = {
  article: Article;
  locale: Locale;
};

const formatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function ArticleHero({ article, locale }: ArticleHeroProps) {
  const t = article.translations[locale];
  if (!t) return null;

  const mins = readingTime(t.body);

  return (
    <article className="group relative mb-8 overflow-hidden rounded-xl border border-white/10">
      <Link href={`/${locale}/${article.category}/${article.slug}`} className="block">
        <div className="relative aspect-[21/9] bg-zinc-900">
          {article.coverImage?.url ? (
            <Image
              src={article.coverImage.url}
              alt={article.coverImage.alt ?? t.title}
              fill
              priority
              className="object-cover opacity-75 transition duration-500 group-hover:opacity-85 group-hover:scale-[1.02]"
              sizes="100vw"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(ellipse_at_20%_50%,rgba(34,211,238,0.12),transparent_60%),linear-gradient(135deg,#18181b,#09090b)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-cyan-400 px-2 py-0.5 font-bold uppercase tracking-wider text-zinc-950">
              {article.category}
            </span>
            <span className="text-zinc-400">{mins} min read</span>
            {article.publishedAt && (
              <time className="text-zinc-500" dateTime={article.publishedAt}>
                {formatter.format(new Date(article.publishedAt))}
              </time>
            )}
          </div>
          <h2 className="mt-3 max-w-3xl text-balance text-2xl font-black leading-tight text-white transition group-hover:text-cyan-50 sm:text-3xl lg:text-4xl">
            {t.title}
          </h2>
          <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">
            {t.excerpt}
          </p>
        </div>
      </Link>
    </article>
  );
}
