import Link from "next/link";
import { notFound } from "next/navigation";
import HeroSection from "@/components/HeroSection";
import ArticleCard from "@/components/ArticleCard";
import TelegramCTA from "@/components/TelegramCTA";
import { getArticleCount, getArticlesPage } from "@/lib/sanity";
import { BASE_URL } from "@/lib/config";
import { categories, categoryLabels, type Category } from "@/lib/i18n";

export const CATEGORY_PAGE_SIZE = 24;

export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
  crypto: "Bitcoin, Ethereum, DeFi, NFTs and the broader crypto market - breaking news, price analysis and regulation updates.",
  markets: "Stock markets, commodities, gold, oil and global indices - market moving news and expert analysis.",
  economy: "Federal Reserve, interest rates, CPI inflation, GDP and macroeconomic trends shaping financial markets.",
  fintech: "Payment technology, neobanks, stablecoins, CBDCs and the future of financial services.",
  policy: "SEC, CFTC, MiCA, crypto regulation and government policy impacting digital assets and markets.",
  companies: "Earnings reports, IPOs, M&A, corporate strategy and company news from major financial players.",
};

type Props = {
  category: Category;
  page?: number;
};

export default async function CategoryArchive({ category, page = 1 }: Props) {
  if (page < 1) notFound();

  const [articles, totalArticles] = await Promise.all([
    getArticlesPage(category, page, CATEGORY_PAGE_SIZE),
    getArticleCount(category),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalArticles / CATEGORY_PAGE_SIZE));
  if (page > totalPages && totalArticles > 0) notFound();

  const label = categoryLabels[category];
  const description = CATEGORY_DESCRIPTIONS[category] ?? `Latest ${label} news.`;
  const hero = page === 1 ? articles.slice(0, 5) : [];
  const rest = page === 1 ? articles.slice(5) : articles;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: label, item: `${BASE_URL}/${category}` },
      ...(page > 1
        ? [{ "@type": "ListItem", position: 3, name: `Page ${page}`, item: `${BASE_URL}/${category}/page/${page}` }]
        : []),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 border-b border-white/[0.06] pb-6">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">Section</p>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {label} News{page > 1 ? ` - Page ${page}` : ""}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">{description}</p>
        </div>

        <nav aria-label="Category navigation" className="mb-8 flex flex-wrap gap-2">
          <Link href="/" className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-white/[0.12] hover:text-white">
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/${cat}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${cat === category ? "border-cyan-400 bg-cyan-400 text-zinc-950" : "border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-white"}`}
            >
              {categoryLabels[cat]}
            </Link>
          ))}
        </nav>

        {articles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-zinc-600">
            No {label.toLowerCase()} articles yet.
          </div>
        ) : (
          <div className="space-y-10">
            {hero.length > 0 && <HeroSection articles={hero} />}
            {rest.length > 0 && (
              <section>
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    {page === 1 ? `More ${label}` : `${label} Archive`}
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((article) => <ArticleCard key={article._id} article={article} />)}
                </div>
              </section>
            )}
            <Pagination category={category} page={page} totalPages={totalPages} />
            <TelegramCTA compact />
          </div>
        )}
      </main>
    </>
  );
}

function pageHref(category: Category, page: number) {
  return page <= 1 ? `/${category}` : `/${category}/page/${page}`;
}

function Pagination({ category, page, totalPages }: { category: Category; page: number; totalPages: number }) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  return (
    <nav aria-label="Archive pagination" className="flex flex-wrap items-center justify-center gap-2 border-t border-white/[0.06] pt-8">
      {page > 1 && (
        <Link href={pageHref(category, page - 1)} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-cyan-400/40 hover:text-white">
          Previous
        </Link>
      )}
      {pages.map((p, index) => {
        const prev = pages[index - 1];
        return (
          <span key={p} className="flex items-center gap-2">
            {prev && p - prev > 1 && <span className="text-xs text-zinc-700">...</span>}
            <Link
              href={pageHref(category, p)}
              aria-current={p === page ? "page" : undefined}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${p === page ? "border-cyan-400 bg-cyan-400 text-zinc-950" : "border-white/[0.08] text-zinc-500 hover:border-cyan-400/40 hover:text-white"}`}
            >
              {p}
            </Link>
          </span>
        );
      })}
      {page < totalPages && (
        <Link href={pageHref(category, page + 1)} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-cyan-400/40 hover:text-white">
          Next
        </Link>
      )}
    </nav>
  );
}
