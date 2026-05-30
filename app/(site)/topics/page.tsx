import type { Metadata } from "next";
import Link from "next/link";
import { getTopicHubs } from "@/lib/sanity";

export const metadata: Metadata = {
  title: "Finance & Crypto Topic Hubs | FinCNews",
  description: "Deep topic hubs for Bitcoin, Ethereum, crypto regulation, Federal Reserve policy, stablecoins and market structure.",
  alternates: { canonical: "/topics" },
};

export default async function TopicsPage() {
  const hubs = await getTopicHubs();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 border-b border-white/[0.06] pb-6">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400">Research</p>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Topic Hubs</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Evergreen explainers and live context pages maintained by the FinCNews editorial agent.
        </p>
      </div>

      {hubs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-12 text-center text-zinc-600">
          Topic hubs will appear here after the editorial agent publishes them.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hubs.map((hub) => (
            <Link
              key={hub._id}
              href={`/topics/${hub.slug}`}
              className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5 transition hover:border-cyan-400/30 hover:bg-zinc-900/70"
            >
              <h2 className="text-lg font-black tracking-tight text-white">{hub.title}</h2>
              {hub.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-500">{hub.description}</p>}
              {hub.keywords && hub.keywords.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {hub.keywords.slice(0, 4).map((kw) => (
                    <span key={kw} className="rounded-md border border-white/[0.06] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
