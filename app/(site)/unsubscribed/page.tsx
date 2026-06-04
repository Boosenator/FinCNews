import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribed — FinCNews",
  robots: { index: false },
};

export default function UnsubscribedPage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-2xl font-bold tracking-tight text-zinc-100">
          You've unsubscribed.
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-zinc-500">
          You won't receive any more emails from FinCNews. You can resubscribe any time from the site.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-white/10 px-5 py-2.5 text-sm text-zinc-400 transition hover:border-white/20 hover:text-white"
        >
          Back to FinCNews
        </Link>
      </div>
    </main>
  );
}
