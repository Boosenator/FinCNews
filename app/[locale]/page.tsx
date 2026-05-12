import ArticleCard from "@/components/ArticleCard";
import CategoryNav from "@/components/CategoryNav";
import TelegramCTA from "@/components/TelegramCTA";
import { getMessages, isLocale, type Locale } from "@/lib/i18n";
import { getArticles } from "@/lib/sanity";
import { notFound } from "next/navigation";

type HomePageProps = {
  params: {
    locale: string;
  };
};

export default async function HomePage({ params }: HomePageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const [messages, articles] = await Promise.all([getMessages(locale), getArticles(locale)]);
  const home = messages.home;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <section className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
            {home.kicker}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
            {home.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">{home.subtitle}</p>
        </div>
        <TelegramCTA title={home.telegramTitle} text={home.telegramText} />
      </section>

      <div className="mb-7">
        <CategoryNav locale={locale} labels={messages.categories} />
      </div>

      {articles.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article._id} article={article} locale={locale} />
          ))}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
          <h2 className="text-xl font-semibold text-white">{home.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-400">{home.emptyText}</p>
        </section>
      )}
    </main>
  );
}
