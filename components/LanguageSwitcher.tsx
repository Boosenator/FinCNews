"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { localeLabels, locales, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const pathname = usePathname();
  const params = useParams<{ locale?: Locale }>();
  const activeLocale = params.locale ?? "ua";
  const segments = pathname.split("/");

  return (
    <nav aria-label="Language switcher" className="flex items-center rounded-md border border-white/10 bg-white/[0.03] p-1">
      {locales.map((locale) => {
        segments[1] = locale;
        const href = segments.join("/") || `/${locale}`;
        const isActive = locale === activeLocale;

        return (
          <Link
            key={locale}
            href={href}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition ${
              isActive
                ? "bg-cyan-300 text-zinc-950"
                : "text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            }`}
          >
            {localeLabels[locale]}
          </Link>
        );
      })}
    </nav>
  );
}
