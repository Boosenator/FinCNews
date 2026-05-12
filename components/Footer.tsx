import Link from "next/link";
import { categories, type Locale } from "@/lib/i18n";

type FooterProps = {
  locale: Locale;
  labels: Record<string, string>;
};

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.266 5.644 5.898-5.644zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function Footer({ locale, labels }: FooterProps) {
  return (
    <footer className="mt-20 border-t border-white/[0.06] bg-zinc-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Link href={`/${locale}`} className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-white">FinCNews</span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400">Finance</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-400">
              Fast, AI-powered finance intelligence. Crypto, markets, macro and fintech — delivered in English, Ukrainian, Russian, and Polish.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href="https://t.me/fincnews"
                target="_blank"
                rel="noreferrer"
                aria-label="Telegram channel"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-zinc-400 transition hover:border-cyan-400/40 hover:text-cyan-400"
              >
                <TelegramIcon />
              </a>
              <a
                href="https://x.com/fincnews"
                target="_blank"
                rel="noreferrer"
                aria-label="X (Twitter)"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-zinc-400 transition hover:border-white/30 hover:text-white"
              >
                <XIcon />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Sections</h3>
            <ul className="mt-4 space-y-2.5">
              {categories.map((cat) => (
                <li key={cat}>
                  <Link
                    href={`/${locale}/${cat}`}
                    className="text-sm text-zinc-400 transition hover:text-white"
                  >
                    {labels[cat] ?? cat}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Disclaimer</h3>
            <ul className="mt-4 space-y-3 text-sm text-zinc-500">
              <li>Not financial advice</li>
              <li>AI-assisted content</li>
              <li>Sources cited per article</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/5 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-600">© 2026 FinCNews. All rights reserved.</p>
          <p className="text-xs text-zinc-700">Powered by Sanity · n8n · Claude API</p>
        </div>
      </div>
    </footer>
  );
}
