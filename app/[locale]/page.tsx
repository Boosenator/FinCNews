import ArticleCard from "@/components/ArticleCard";
import ArticleHero from "@/components/ArticleHero";
import CategoryNav from "@/components/CategoryNav";
import TelegramCTA from "@/components/TelegramCTA";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { getArticles } from "@/lib/sanity";
import { notFound } from "next/navigation";

type HomePageProps = {
  params: { locale: string };
};

export default async function HomePage({ params }: HomePageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const [messages, articles] = await Promise.all([getMessages(locale), getArticles(locale)]);
  const home = messages.home;

  const [heroArticle, ...restArticles] = articles;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Page header */}
      <section className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
          {home.kicker}
        </p>
        <h1 className="mt-2 max-w-3xl text-balance text-3xl font-black tracking-tight text-white sm:text-4xl">
          {home.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{home.subtitle}</p>
      </section>

      {/* Category nav */}
      <div className="mb-6">
        <CategoryNav locale={locale} labels={messages.categories} />
      </div>

      {articles.length === 0 ? (
        <section className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
          <h2 className="text-xl font-semibold text-white">{home.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">{home.emptyText}</p>
        </section>
      ) : (
        <>
          {/* Hero */}
          {heroArticle && <ArticleHero article={heroArticle} locale={locale} />}

          {/* Grid + Sidebar */}
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            <section className="grid gap-4 sm:grid-cols-2">
              {restArticles.map((article) => (
                <ArticleCard key={article._id} article={article} locale={locale} />
              ))}
            </section>

            <aside className="space-y-5">
              {/* Trending list */}
              {articles.length > 1 && (
                <div className="rounded-xl border border-white/8 bg-white/[0.02] p-5">
                  <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                    {messages.trending.title}
                  </h2>
                  <ol className="space-y-3">
                    {articles.slice(0, 5).map((article, i) => {
                      const t = article.translations[locale];
                      if (!t) return null;
                      return (
                        <li key={article._id} className="flex gap-3">
                          <span className="mt-0.5 shrink-0 text-sm font-black tabular-nums text-zinc-700">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <a
                            href={`/${locale}/${article.category}/${article.slug}`}
                            className="text-sm font-medium leading-snug text-zinc-300 transition hover:text-white line-clamp-2"
                          >
                            {t.title}
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <TelegramCTA title={home.telegramTitle} text={home.telegramText} />
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
