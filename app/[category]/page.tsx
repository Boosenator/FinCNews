import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import HeroSection from "@/components/HeroSection";
import ArticleCard from "@/components/ArticleCard";
import TelegramCTA from "@/components/TelegramCTA";
import { getArticles } from "@/lib/sanity";
import { isCategory, categoryLabels, categories, type Category } from "@/lib/i18n";

type Props = { params: { category: string } };

export function generateStaticParams() {
  return categories.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isCategory(params.category)) return {};
  const label = categoryLabels[params.category as Category];
  return {
    title: `${label} News`,
    description: `Latest ${label} news, market analysis and breaking stories on FinCNews.`,
    openGraph: { title: `${label} News | FinCNews` },
  };
}

export default async function CategoryPage({ params }: Props) {
  if (!isCategory(params.category)) notFound();

  const category = params.category as Category;
  const articles = await getArticles(category);
  const label = categoryLabels[category];

  const hero = articles.slice(0, 5);
  const rest = articles.slice(5);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Category header */}
      <div className="mb-8 border-b border-white/[0.06] pb-6">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">Section</p>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">{label}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Latest {label.toLowerCase()} news, analysis and market intelligence.
        </p>
      </div>

      {/* Category nav */}
      <nav className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/"
          className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-white/[0.12] hover:text-white"
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat}
            href={`/${cat}`}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              cat === category
                ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                : "border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-white"
            }`}
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
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500">More {label}</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((article) => (
                  <ArticleCard key={article._id} article={article} />
                ))}
              </div>
            </section>
          )}

          <TelegramCTA compact />
        </div>
      )}
    </main>
  );
}
