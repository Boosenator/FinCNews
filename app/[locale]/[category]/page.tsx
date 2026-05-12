import ArticleCard from "@/components/ArticleCard";
import ArticleHero from "@/components/ArticleHero";
import CategoryNav from "@/components/CategoryNav";
import { getMessages, isCategory, isLocale, type Category, type Locale } from "@/lib/i18n";
import { getArticles } from "@/lib/sanity";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

type CategoryPageProps = {
  params: { locale: string; category: string };
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  if (!isLocale(params.locale) || !isCategory(params.category)) return {};
  const messages = await getMessages(params.locale as Locale);
  const label = messages.categories[params.category];
  return {
    title: `${label} News`,
    description: `Latest ${label} news, analysis and market intelligence on FinCNews.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  if (!isLocale(params.locale) || !isCategory(params.category)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const category = params.category as Category;
  const [messages, articles] = await Promise.all([getMessages(locale), getArticles(locale, category)]);

  const [heroArticle, ...restArticles] = articles;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
          {messages.category.kicker}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          {messages.categories[category]}
        </h1>
      </div>

      <div className="mb-6">
        <CategoryNav locale={locale} labels={messages.categories} activeCategory={category} />
      </div>

      {articles.length === 0 ? (
        <section className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center text-zinc-400">
          {messages.category.empty}
        </section>
      ) : (
        <>
          {heroArticle && <ArticleHero article={heroArticle} locale={locale} />}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restArticles.map((article) => (
              <ArticleCard key={article._id} article={article} locale={locale} />
            ))}
          </section>
        </>
      )}
    </main>
  );
}
