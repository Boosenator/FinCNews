import type { Metadata } from "next";
import HeroSection from "@/components/HeroSection";
import ArticleCard from "@/components/ArticleCard";
import TelegramCTA from "@/components/TelegramCTA";
import { getArticles } from "@/lib/sanity";
import { categories, categoryLabels } from "@/lib/i18n";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Finance & Crypto News — Markets, Bitcoin, Economy",
  description:
    "Breaking finance and crypto news: Bitcoin, Ethereum, Federal Reserve, markets and fintech — AI-powered analysis updated every 15 minutes.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const articles = await getArticles();

  const hero = articles.slice(0, 5);
  const latest = articles.slice(5);

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "FinCNews",
    url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app",
    description: "AI-powered finance and crypto news — markets, Bitcoin, macro and fintech.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app"}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FinCNews",
    url: process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app",
    logo: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app"}/logo.jpg`,
    sameAs: [
      "https://t.me/FinCNews",
      "https://x.com/fincnews",
    ],
    description: "AI-powered finance intelligence covering crypto, markets, macro and fintech.",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      <main>
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {articles.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* H1 — required for every page */}
              <h1 className="sr-only">Finance & Crypto News — FinCNews</h1>

              {/* Hero editorial grid */}
              <section aria-label="Top stories" className="mb-10">
                <SectionHeader label="Top Stories" />
                <HeroSection articles={hero} />
              </section>

              {/* Category quick links */}
              <section aria-label="News categories" className="mb-10">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {categories.map((cat) => (
                    <Link
                      key={cat}
                      href={`/${cat}`}
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/40 py-3.5 text-sm font-semibold text-zinc-400 transition hover:border-cyan-400/30 hover:bg-zinc-900/80 hover:text-white"
                    >
                      {categoryLabels[cat]}
                    </Link>
                  ))}
                </div>
              </section>

              {/* Latest + sidebar */}
              {latest.length > 0 && (
                <section className="mb-10">
                  <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
                    <div>
                      <SectionHeader label="Latest" />
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {latest.map((article) => (
                          <ArticleCard key={article._id} article={article} />
                        ))}
                      </div>
                    </div>

                    <aside>
                      <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
                        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Trending</h2>
                        <ol className="space-y-3.5">
                          {articles.slice(0, 5).map((article, i) => {
                            const t = article.en;
                            if (!t) return null;
                            return (
                              <li key={article._id} className="flex gap-3">
                                <span className="mt-0.5 w-5 shrink-0 text-sm font-black tabular-nums text-zinc-700">
                                  {String(i + 1).padStart(2, "0")}
                                </span>
                                <div>
                                  <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                                    {categoryLabels[article.category]}
                                  </p>
                                  <Link
                                    href={`/${article.category}/${article.slug}`}
                                    className="text-sm font-medium leading-snug text-zinc-300 transition hover:text-white line-clamp-2"
                                  >
                                    {t.title}
                                  </Link>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </div>

                      <div className="mt-5">
                        <TelegramCTA />
                      </div>
                    </aside>
                  </div>
                </section>
              )}

              <CategoriesSpotlight articles={articles} />
            </>
          )}
        </div>
      </main>
    </>
  );
}

async function CategoriesSpotlight({ articles }: { articles: Awaited<ReturnType<typeof getArticles>> }) {
  const featured = ["crypto", "markets", "economy"] as const;
  return (
    <div className="space-y-10">
      {featured.map((cat) => {
        const catArticles = articles.filter((a) => a.category === cat).slice(0, 3);
        if (catArticles.length === 0) return null;
        return (
          <section key={cat} aria-label={`${categoryLabels[cat]} news`}>
            <div className="mb-4 flex items-center justify-between">
              <SectionHeader label={categoryLabels[cat]} />
              <Link href={`/${cat}`} className="text-xs font-semibold text-zinc-500 transition hover:text-cyan-400">
                All {categoryLabels[cat]} →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {catArticles.map((article) => (
                <ArticleCard key={article._id} article={article} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{label}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
      <div className="mb-4 text-5xl opacity-20">📰</div>
      <h1 className="text-xl font-black text-white">No articles yet</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
        Configure Sanity in .env.local or publish via{" "}
        <code className="rounded bg-white/5 px-1 text-cyan-400">/api/publish</code>
      </p>
    </div>
  );
}
