import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BASE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Authors | FinCNews",
  description: "Meet the FinCNews editorial team — AI-powered analysts covering macro, on-chain data, and crypto market narratives.",
  alternates: { canonical: "/author" },
  openGraph: {
    title: "Authors | FinCNews",
    description: "Meet the FinCNews editorial team.",
    url: `${BASE_URL}/author`,
  },
};

const AUTHORS = [
  {
    id: "elena-voss",
    name: "Elena Voss",
    role: "Macro Bear",
    avatar: "/authors/elena-voss.png",
    bio: "12 years in traditional finance — fixed income at Deutsche Bank, macro at a European family office. Covers Fed policy, Treasury yields, DXY, and the intersection of macro forces with crypto markets.",
    focus: ["Fed Policy", "Treasury Yields", "DXY", "CPI / PCE", "SEC Regulation"],
    active: true,
  },
  {
    id: "marcus-webb",
    name: "Marcus Webb",
    role: "On-Chain Analyst",
    avatar: "/authors/marcus-webb.png",
    bio: "Former quantitative analyst. Tracks whale movements, exchange flows, miner behavior, and on-chain anomalies. Publishes only when the data shows something abnormal.",
    focus: ["Exchange Flows", "Whale Activity", "Hashrate", "UTXO Analysis", "Network Health"],
    active: false,
  },
  {
    id: "leo-cruz",
    name: "Leo Cruz",
    role: "Narrative Hunter",
    avatar: "/authors/leo-cruz.png",
    bio: "Entered crypto in DeFi Summer 2020. Tracks how narratives form, peak, and die — using social data, trending signals, and sentiment shifts before they reach mainstream coverage.",
    focus: ["Trending Tokens", "Narrative Cycles", "Sentiment Shifts", "Reddit / CT", "DeFi Narratives"],
    active: false,
  },
];

export default function AuthorsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white">Editorial Team</h1>
        <p className="mt-2 text-sm text-zinc-500">
          FinCNews analysts — each covering a distinct signal layer of the crypto market.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {AUTHORS.map((author) => (
          <div
            key={author.id}
            className="flex flex-col rounded-xl border border-white/[0.06] bg-zinc-900/40 p-6"
          >
            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border border-white/[0.08]">
                <Image
                  src={author.avatar}
                  alt={author.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="font-black text-white">{author.name}</p>
                <p className="text-xs text-zinc-500">{author.role}</p>
              </div>
              {!author.active && (
                <span className="ml-auto rounded border border-white/[0.06] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                  Soon
                </span>
              )}
            </div>

            {/* Bio */}
            <p className="mt-4 flex-1 text-sm leading-6 text-zinc-400">{author.bio}</p>

            {/* Focus tags */}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {author.focus.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-white/[0.06] px-2 py-0.5 text-[11px] text-zinc-600"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Articles link */}
            <div className="mt-5 border-t border-white/[0.04] pt-4">
              {author.active ? (
                <Link
                  href={`/${author.id === "elena-voss" ? "economy" : "crypto"}?author=${author.id}`}
                  className="text-xs font-semibold text-cyan-400 hover:underline"
                >
                  View articles →
                </Link>
              ) : (
                <p className="text-xs text-zinc-700">Articles coming soon</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
