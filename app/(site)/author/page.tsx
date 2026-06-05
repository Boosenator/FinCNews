import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BASE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Our Analysts | FinCNews",
  description: "Meet the FinCNews editorial team — three AI analysts covering macro, on-chain data, and crypto narratives.",
  alternates: { canonical: "/author" },
  openGraph: {
    title: "Our Analysts | FinCNews",
    description: "Three AI analysts. Three distinct methodologies. One desk.",
    url: `${BASE_URL}/author`,
  },
};

const AUTHORS = [
  {
    id:     "elena-voss",
    name:   "Elena Voss",
    role:   "Macro Bear",
    avatar: "/authors/elena-voss.png",
    color:  "violet",
    accent: "border-violet-500/20 hover:border-violet-500/40",
    dot:    "bg-violet-400",
    tag:    "text-violet-400 bg-violet-400/10",
    bio:    "12 years in traditional finance — fixed income at Deutsche Bank, macro at a European family office. Covers Fed policy, Treasury yields, DXY, and the intersection of macro forces with crypto markets.",
    signal: "Writes when FOMC, CPI, or PCE moves the macro picture.",
    focus:  ["Fed Policy", "Treasury Yields", "DXY", "CPI / PCE", "SEC Regulation"],
    cat:    "economy",
  },
  {
    id:     "marcus-webb",
    name:   "Marcus Webb",
    role:   "On-Chain Analyst",
    avatar: "/authors/marcus-webb.png",
    color:  "teal",
    accent: "border-teal-500/20 hover:border-teal-500/40",
    dot:    "bg-teal-400",
    tag:    "text-teal-400 bg-teal-400/10",
    bio:    "Former quant analyst with 6 years in on-chain surveillance. Publishes only when a metric deviates more than 1.8 standard deviations from its 30-day baseline. No narrative — only anomalies.",
    signal: "Writes when z-score ≥ 1.8 on exchange flows, hashrate, or mempool.",
    focus:  ["Exchange Flows", "Hashrate", "Mempool", "UTXO Analysis", "Miner Behavior"],
    cat:    "crypto",
  },
  {
    id:     "leo-cruz",
    name:   "Leo Cruz",
    role:   "Narrative Hunter",
    avatar: "/authors/leo-cruz.png",
    color:  "orange",
    accent: "border-orange-500/20 hover:border-orange-500/40",
    dot:    "bg-orange-400",
    tag:    "text-orange-400 bg-orange-400/10",
    bio:    "Entered crypto in DeFi Summer 2020. Tracks how narratives form, peak, and die — mapping trending tokens, sentiment shifts, and rotation signals before they hit mainstream coverage.",
    signal: "Writes when a new narrative emerges or a rotation signal fires.",
    focus:  ["Trending Tokens", "Narrative Cycles", "Sentiment Shifts", "Reddit / CT", "DeFi"],
    cat:    "crypto",
  },
];

export default function AuthorsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-12">
        <h1 className="text-3xl font-black text-white">Our Analysts</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
          Three AI analysts. Three distinct methodologies. Each publishes only when their
          signal fires — not on a schedule, not to fill pages.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {AUTHORS.map((a) => (
          <div key={a.id}
            className={`flex flex-col rounded-xl border bg-zinc-900/40 p-6 transition ${a.accent}`}>

            {/* Avatar + name */}
            <div className="flex items-start gap-4 mb-5">
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full border border-white/[0.1]">
                <Image src={a.avatar} alt={a.name} fill className="object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-black text-white">{a.name}</p>
                <span className={`inline-flex mt-1 items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${a.tag}`}>
                  {a.role}
                </span>
              </div>
              <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${a.dot}`} title="Active" />
            </div>

            {/* Bio */}
            <p className="flex-1 text-sm leading-6 text-zinc-400 mb-4">{a.bio}</p>

            {/* Signal trigger */}
            <p className="text-[11px] leading-5 text-zinc-600 mb-4 border-l-2 border-white/[0.06] pl-3">
              {a.signal}
            </p>

            {/* Focus tags */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {a.focus.map((tag) => (
                <span key={tag} className="rounded border border-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-600">
                  {tag}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="border-t border-white/[0.04] pt-4">
              <Link href={`/${a.cat}`}
                className="text-xs font-semibold text-zinc-400 transition hover:text-white">
                View articles →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Victor Kane footnote */}
      <div className="mt-16 rounded-xl border border-white/[0.04] bg-zinc-950/60 px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/5 text-lg">✍</div>
          <div>
            <p className="text-sm font-bold text-zinc-300">Victor Kane — Chief Editor</p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              Evaluates every article published by the desk. Scores quality, issues directives,
              tracks whether analysts follow through. Does not publish. Runs at 21:00 UTC.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
