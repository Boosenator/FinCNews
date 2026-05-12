import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/sanity";
import { readingTime, timeAgo } from "@/lib/sanity";
import { categoryLabels } from "@/lib/i18n";

type ArticleCardProps = {
  article: Article;
  size?: "default" | "compact" | "large";
};

export default function ArticleCard({ article, size = "default" }: ArticleCardProps) {
  const { en: t } = article;
  if (!t) return null;

  const mins = readingTime(t.body);
  const ago = timeAgo(article.publishedAt);
  const href = `/${article.category}/${article.slug}`;
  const label = categoryLabels[article.category] ?? article.category;

  if (size === "compact") {
    return (
      <article className="group flex gap-3 py-3">
        <Link href={href} className="flex gap-3 flex-1">
          {article.coverImage?.url && (
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-zinc-800">
              <Image
                src={article.coverImage.url}
                alt={article.coverImage.alt ?? t.title}
                fill
                className="object-cover transition duration-300 group-hover:scale-105"
                sizes="96px"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400">{label}</p>
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-200 transition group-hover:text-white">
              {t.title}
            </h3>
            <p className="mt-1 text-[10px] text-zinc-600">{ago} · {mins} min read</p>
          </div>
        </Link>
      </article>
    );
  }

  if (size === "large") {
    return (
      <article className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/50">
        <Link href={href} className="block">
          <div className="relative aspect-[16/9] bg-zinc-900">
            {article.coverImage?.url ? (
              <Image
                src={article.coverImage.url}
                alt={article.coverImage.alt ?? t.title}
                fill
                priority
                className="object-cover opacity-80 transition duration-500 group-hover:opacity-95 group-hover:scale-[1.02]"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(ellipse_at_20%_50%,rgba(34,211,238,0.1),transparent_60%),linear-gradient(135deg,#18181b,#09090b)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
          </div>
          <div className="p-5">
            <div className="mb-2 flex items-center gap-2 text-[10px]">
              <span className="rounded bg-cyan-400/15 px-2 py-0.5 font-bold uppercase tracking-wider text-cyan-400">
                {label}
              </span>
              <span className="text-zinc-600">{ago}</span>
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-600">{mins} min read</span>
            </div>
            <h2 className="text-lg font-black leading-snug tracking-tight text-white transition group-hover:text-cyan-50">
              {t.title}
            </h2>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{t.excerpt}</p>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/40 transition hover:border-white/[0.12] hover:bg-zinc-900/70">
      <Link href={href} className="flex flex-col flex-1">
        <div className="relative aspect-[16/9] shrink-0 bg-zinc-900 overflow-hidden">
          {article.coverImage?.url ? (
            <Image
              src={article.coverImage.url}
              alt={article.coverImage.alt ?? t.title}
              fill
              className="object-cover opacity-85 transition duration-300 group-hover:opacity-100 group-hover:scale-[1.04]"
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,0.08),transparent_50%),linear-gradient(135deg,#18181b,#09090b)]">
              <span className="text-3xl opacity-20">{article.category === "crypto" ? "₿" : "📈"}</span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-bold uppercase tracking-wider text-cyan-400">{label}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-600">{ago}</span>
          </div>
          <h2 className="line-clamp-3 text-sm font-semibold leading-snug text-zinc-100 transition group-hover:text-white">
            {t.title}
          </h2>
          <p className="line-clamp-2 flex-1 text-xs leading-5 text-zinc-500">{t.excerpt}</p>
          <p className="mt-auto text-[10px] text-zinc-700">{mins} min read</p>
        </div>
      </Link>
    </article>
  );
}
