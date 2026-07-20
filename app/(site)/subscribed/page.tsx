import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscribed — FinCNews",
  robots: { index: false },
};

export default function SubscribedPage({
  searchParams,
}: {
  searchParams: { already?: string };
}) {
  const already = searchParams.already === "1";

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-400/10 ring-1 ring-cyan-400/20">
            <svg
              className="h-7 w-7 text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </div>

        <h1 className="mb-3 text-2xl font-bold tracking-tight text-zinc-100">
          {already ? "Already confirmed" : "You're in!"}
        </h1>
        <p className="mb-8 text-sm leading-relaxed text-zinc-500">
          {already
            ? "Your subscription is already active. Breaking alerts and weekly digests are on their way."
            : "Your subscription is confirmed. Expect breaking alerts and a weekly digest of the top finance stories in your inbox."}
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
