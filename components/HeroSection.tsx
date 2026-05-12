import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/lib/sanity";
import { readingTime, timeAgo } from "@/lib/sanity";
import { categoryLabels } from "@/lib/i18n";

type HeroSectionProps = {
  articles: Article[];
};

export default function HeroSection({ articles }: HeroSectionProps) {
  const [main, ...side] = articles;
  if (!main) return null;

  const mainT = main.en;
  if (!mainT) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {/* Main hero */}
      <article className="group relative overflow-hidden rounded-xl border border-white/[0.06]">
        <Link href={`/${main.category}/${main.slug}`} className="block">
          <div className="relative aspect-[16/9] bg-zinc-900 lg:aspect-[4/3]">
            {main.coverImage?.url ? (
              <Image
                src={main.coverImage.url}
                alt={main.coverImage.alt ?? mainT.title}
                fill
                priority
                className="object-cover opacity-75 transition duration-500 group-hover:opacity-90 group-hover:scale-[1.02]"
                sizes="(min-width: 1024px) 60vw, 100vw"
              />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(ellipse_at_15%_40%,rgba(34,211,238,0.15),transparent_55%),linear-gradient(160deg,#18181b_0%,#09090b_100%)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-sm bg-cyan-400 px-2 py-0.5 font-bold uppercase tracking-wider text-zinc-950">
                {categoryLabels[main.category] ?? main.category}
              </span>
              <span className="text-zinc-400">{timeAgo(main.publishedAt)}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-400">{readingTime(mainT.body)} min read</span>
            </div>
            <h2 className="max-w-xl text-balance text-xl font-black leading-tight text-white transition group-hover:text-cyan-50 sm:text-2xl lg:text-3xl">
              {mainT.title}
            </h2>
            <p className="mt-2 line-clamp-2 max-w-lg text-sm leading-6 text-zinc-300">
              {mainT.excerpt}
            </p>
          </div>
        </Link>
      </article>

      {/* Side articles */}
      <div className="flex flex-col divide-y divide-white/[0.05]">
        {side.slice(0, 4).map((article) => {
          const t = article.en;
          if (!t) return null;
          return (
            <article key={article._id} className="group flex gap-3 py-3.5 first:pt-0 last:pb-0">
              <Link href={`/${article.category}/${article.slug}`} className="flex gap-3 flex-1">
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-zinc-900">
                  {article.coverImage?.url ? (
                    <Image
                      src={article.coverImage.url}
                      alt={article.coverImage.alt ?? t.title}
                      fill
                      className="object-cover transition duration-300 group-hover:scale-105"
                      sizes="112px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-zinc-800 text-xs text-zinc-600">
                      {article.category}
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center gap-1.5 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                    {categoryLabels[article.category] ?? article.category}
                  </p>
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-200 transition group-hover:text-white">
                    {t.title}
                  </h3>
                  <p className="text-[10px] text-zinc-600">
                    {timeAgo(article.publishedAt)} · {readingTime(t.body)} min read
                  </p>
                </div>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
