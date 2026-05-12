import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/sanity";
import { readingTime } from "@/lib/sanity";
import type { Locale } from "@/lib/i18n";

type ArticleCardProps = {
  article: Article;
  locale: Locale;
};

const formatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default function ArticleCard({ article, locale }: ArticleCardProps) {
  const t = article.translations[locale];
  if (!t) return null;

  const mins = readingTime(t.body);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-zinc-900/40 transition hover:border-cyan-400/30 hover:bg-zinc-900/70">
      <Link href={`/${locale}/${article.category}/${article.slug}`} className="flex flex-col flex-1">
        <div className="relative aspect-[16/9] shrink-0 bg-zinc-900">
          {article.coverImage?.url ? (
            <Image
              src={article.coverImage.url}
              alt={article.coverImage.alt ?? t.title}
              fill
              className="object-cover opacity-85 transition duration-300 group-hover:opacity-100 group-hover:scale-[1.03]"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.12),transparent_50%),linear-gradient(135deg,#18181b,#09090b)]">
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-700">
                {article.category}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider">
            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-zinc-400">
              {article.category}
            </span>
            <span className="text-zinc-600">{mins} min read</span>
          </div>

          <h2 className="line-clamp-3 text-sm font-semibold leading-snug text-zinc-100 transition group-hover:text-cyan-100">
            {t.title}
          </h2>

          <p className="line-clamp-2 flex-1 text-xs leading-5 text-zinc-500">{t.excerpt}</p>

          {article.publishedAt && (
            <time
              className="mt-auto text-[10px] text-zinc-600"
              dateTime={article.publishedAt}
            >
              {formatter.format(new Date(article.publishedAt))}
            </time>
          )}
        </div>
      </Link>
    </article>
  );
}
