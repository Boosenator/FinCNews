import Image from "next/image";
import Link from "next/link";
import { categories, categoryLabels } from "@/lib/i18n";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/[0.05] bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2">
            <Link href="/" className="flex items-center">
              <Image src="/logo.jpg" alt="FinCNews" width={120} height={31} className="h-8 w-auto" />
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-zinc-500">
              Fast AI-powered finance intelligence. Crypto, markets, macro and fintech — breaking news as it happens.
            </p>
            <div className="mt-5 flex gap-3">
              <a
                href="https://t.me/fincnews"
                target="_blank"
                rel="noreferrer"
                aria-label="Telegram"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-zinc-500 transition hover:border-cyan-400/40 hover:text-cyan-400"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </a>
              <a
                href="https://x.com/fincnews"
                target="_blank"
                rel="noreferrer"
                aria-label="X (Twitter)"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-zinc-500 transition hover:border-white/30 hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.266 5.644 5.898-5.644zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="/api/feed"
                aria-label="RSS feed"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-zinc-500 transition hover:border-white/25 hover:text-zinc-300"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Sections */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-600">
              Sections
            </h3>
            <ul className="space-y-2.5">
              {categories.map((cat) => (
                <li key={cat}>
                  <Link
                    href={`/${cat}`}
                    className="text-sm text-zinc-500 transition hover:text-white"
                  >
                    {categoryLabels[cat]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-600">
              Info
            </h3>
            <ul className="space-y-2.5 text-sm text-zinc-500">
              <li>
                <a href="/api/feed" className="transition hover:text-white">
                  RSS Feed
                </a>
              </li>
              <li>
                <Link href="/sitemap.xml" className="transition hover:text-white">
                  Sitemap
                </Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="transition hover:text-white">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="transition hover:text-white">
                  Privacy Policy
                </Link>
              </li>
              <li className="pt-2 text-xs text-zinc-700">Not financial advice</li>
              <li className="text-xs text-zinc-700">AI-assisted content</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/[0.04] pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-zinc-700">© 2026 FinCNews. All rights reserved.</p>
          <p className="text-xs text-zinc-800">Powered by Sanity · n8n · Claude API</p>
        </div>
      </div>
    </footer>
  );
}
