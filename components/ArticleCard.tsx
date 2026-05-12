import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/sanity";
import type { Locale } from "@/lib/i18n";

type ArticleCardProps = {
  article: Article;
  locale: Locale;
};

const formatter = new Intl.DateTimeFormat("uk-UA", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default function ArticleCard({ article, locale }: ArticleCardProps) {
  const t = article.translations[locale];

  if (!t) {
    return null;
  }

  return (
    <article className="group overflow-hidden rounded-lg border border-white/10 bg-zinc-950 transition hover:border-cyan-400/50">
      <Link href={`/${locale}/${article.category}/${article.slug}`} className="block">
        <div className="relative aspect-[16/9] bg-zinc-900">
          {article.coverImage?.url ? (
            <Image
              src={article.coverImage.url}
              alt={article.coverImage.alt ?? t.title}
              fill
              className="object-cover opacity-90 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#18181b,#09090b)] text-sm uppercase tracking-[0.24em] text-zinc-500">
              News
            </div>
          )}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
            <span>{article.category}</span>
            {article.publishedAt ? (
              <time dateTime={article.publishedAt}>
                {formatter.format(new Date(article.publishedAt))}
              </time>
            ) : null}
          </div>
          <h2 className="text-lg font-semibold leading-snug text-zinc-50 transition group-hover:text-cyan-200">
            {t.title}
          </h2>
          <p className="line-clamp-3 text-sm leading-6 text-zinc-400">{t.excerpt}</p>
        </div>
      </Link>
    </article>
  );
}
