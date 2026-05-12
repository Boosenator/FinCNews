import Link from "next/link";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getMessages, isLocale, locales, type Locale } from "@/lib/i18n";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: {
    locale: string;
  };
};

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
        <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href={`/${locale}`} className="flex items-baseline gap-2">
              <span className="text-xl font-black tracking-tight text-white">SEOtoTG</span>
              <span className="hidden text-xs uppercase tracking-[0.24em] text-cyan-300 sm:inline">
                News
              </span>
            </Link>
            <LanguageSwitcher />
          </div>
        </header>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
