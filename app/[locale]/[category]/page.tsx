import ArticleCard from "@/components/ArticleCard";
import CategoryNav from "@/components/CategoryNav";
import { getMessages, isCategory, isLocale, type Category, type Locale } from "@/lib/i18n";
import { getArticles } from "@/lib/sanity";
import { notFound } from "next/navigation";

type CategoryPageProps = {
  params: {
    locale: string;
    category: string;
  };
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  if (!isLocale(params.locale) || !isCategory(params.category)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const category = params.category as Category;
  const [messages, articles] = await Promise.all([getMessages(locale), getArticles(locale, category)]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
          {messages.category.kicker}
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white">
          {messages.categories[category]}
        </h1>
      </div>
      <div className="mb-7">
        <CategoryNav locale={locale} labels={messages.categories} activeCategory={category} />
      </div>
      {articles.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article._id} article={article} locale={locale} />
          ))}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-zinc-400">
          {messages.category.empty}
        </section>
      )}
    </main>
  );
}
