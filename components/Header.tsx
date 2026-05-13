"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { categories, categoryLabels } from "@/lib/i18n";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-zinc-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center" onClick={() => setOpen(false)}>
          <Image
            src="/logo.jpg"
            alt="FinCNews"
            width={148}
            height={38}
            priority
            className="h-9 w-auto"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main navigation">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/${cat}`}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              {categoryLabels[cat]}
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          <a
            href="https://t.me/FinCNews"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20 hover:text-cyan-200 sm:flex"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            Free alerts
          </a>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-zinc-400 transition hover:border-white/20 hover:text-white md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/[0.06] bg-zinc-950 px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            <Link href="/" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white">
              All News
            </Link>
            {categories.map((cat) => (
              <Link key={cat} href={`/${cat}`} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.05] hover:text-white">
                {categoryLabels[cat]}
              </Link>
            ))}
          </nav>
          <div className="mt-3 border-t border-white/[0.04] pt-3">
            <a href="https://t.me/FinCNews" target="_blank" rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
              </span>
              Get free alerts on Telegram
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
