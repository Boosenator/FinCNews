import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Footer from "@/components/Footer";
import { getMessages, isLocale, locales, type Locale } from "@/lib/i18n";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: { locale: string };
};

const MAIN_CATEGORIES = ["finance", "crypto", "tech", "world"] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const locale = params.locale as Locale;
  const messages = await getMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        {/* Top strip */}
        <div className="border-b border-white/[0.04] bg-zinc-900/50">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1.5 sm:px-6">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              <span className="text-red-400">Live</span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">Finance Intelligence</span>
            </div>
            <a
              href="/api/feed"
              className="flex items-center gap-1 text-[10px] text-zinc-600 transition hover:text-zinc-400"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3" aria-hidden>
                <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
              </svg>
              RSS
            </a>
          </div>
        </div>

        {/* Main header */}
        <header className="sticky top-0 z-40 border-b border-white/8 bg-zinc-950/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href={`/${locale}`} className="flex shrink-0 items-baseline gap-1.5">
              <span className="text-xl font-black tracking-tight text-white">FinCNews</span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400 sm:inline">
                Finance
              </span>
            </Link>

            <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main navigation">
              {MAIN_CATEGORIES.map((cat) => (
                <Link
                  key={cat}
                  href={`/${locale}/${cat}`}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
                >
                  {messages.categories[cat]}
                </Link>
              ))}
            </nav>

            <LanguageSwitcher />
          </div>
        </header>

        {children}

        <Footer locale={locale} labels={messages.categories} />
      </div>
    </NextIntlClientProvider>
  );
}
