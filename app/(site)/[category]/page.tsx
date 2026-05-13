import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import HeroSection from "@/components/HeroSection";
import ArticleCard from "@/components/ArticleCard";
import TelegramCTA from "@/components/TelegramCTA";
import { getArticles } from "@/lib/sanity";
import { isCategory, categoryLabels, categories, type Category } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  crypto:    "Bitcoin, Ethereum, DeFi, NFTs and the broader crypto market — breaking news, price analysis and regulation updates.",
  markets:   "Stock markets, commodities, gold, oil and global indices — market moving news and expert analysis.",
  economy:   "Federal Reserve, interest rates, CPI inflation, GDP and macroeconomic trends shaping financial markets.",
  fintech:   "Payment technology, neobanks, stablecoins, CBDCs and the future of financial services.",
  policy:    "SEC, CFTC, MiCA, crypto regulation and government policy impacting digital assets and markets.",
  companies: "Earnings reports, IPOs, M&A, corporate strategy and company news from major financial players.",
};

type Props = { params: { category: string } };

export function generateStaticParams() {
  return categories.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isCategory(params.category)) return {};
  const cat = params.category as Category;
  const label = categoryLabels[cat];
  const description = CATEGORY_DESCRIPTIONS[cat] ?? `Latest ${label} news and analysis on FinCNews.`;

  return {
    title: `${label} News — Latest Updates & Analysis`,
    description,
    alternates: { canonical: `/${cat}` },
    openGraph: {
      title: `${label} News | FinCNews`,
      description,
      type: "website",
      url: `${BASE_URL}/${cat}`,
      siteName: "FinCNews",
      images: [{ url: `${BASE_URL}/opengraph-image`, width: 1200, height: 630, alt: `FinCNews ${label}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${label} News | FinCNews`,
      description,
      site: "@fincnews",
      images: [`${BASE_URL}/opengraph-image`],
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  if (!isCategory(params.category)) notFound();

  const category = params.category as Category;
  const articles = await getArticles(category);
  const label = categoryLabels[category];
  const description = CATEGORY_DESCRIPTIONS[category] ?? `Latest ${label} news.`;

  const hero = articles.slice(0, 5);
  const rest = articles.slice(5);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: label, item: `${BASE_URL}/${category}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 border-b border-white/[0.06] pb-6">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">Section</p>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{label} News</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">{description}</p>
        </div>

        <nav aria-label="Category navigation" className="mb-8 flex flex-wrap gap-2">
          <Link href="/" className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-white/[0.12] hover:text-white">
            All
          </Link>
          {categories.map((cat) => (
            <Link key={cat} href={`/${cat}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${cat === category ? "border-cyan-400 bg-cyan-400 text-zinc-950" : "border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-white"}`}>
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
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">More {label}</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((article) => <ArticleCard key={article._id} article={article} />)}
                </div>
              </section>
            )}
            <TelegramCTA compact />
          </div>
        )}
      </main>
    </>
  );
}
