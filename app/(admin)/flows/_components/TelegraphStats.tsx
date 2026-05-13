"use client";

import { useState } from "react";

type Stat = {
  slug: string;
  category: string;
  title: string;
  telegraphUrl: string;
  views: number;
  publishedAt?: string;
};

type Response = {
  stats: Stat[];
  totalViews: number;
  totalArticles: number;
  error?: string;
};

const CATEGORY_EMOJI: Record<string, string> = {
  crypto: "₿", markets: "📈", economy: "🏦",
  fintech: "⚡", policy: "⚖️", companies: "🏢",
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TelegraphStats() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [data, setData] = useState<Response | null>(null);

  async function load() {
    setState("loading");
    try {
      const res = await fetch("/api/admin/telegraph-stats");
      setData(await res.json());
    } catch (e) {
      setData({ stats: [], totalViews: 0, totalArticles: 0, error: String(e) });
    }
    setState("done");
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">
            Telegraph Views
          </h2>
          {data && state === "done" && !data.error && (
            <span className="text-[10px] text-zinc-600">
              {data.totalArticles} articles · {data.totalViews.toLocaleString()} total views
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={state === "loading"}
          className="rounded-md border border-white/[0.08] px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-cyan-400/30 hover:text-cyan-300 disabled:cursor-wait disabled:opacity-40"
        >
          {state === "loading" ? (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading...
            </span>
          ) : state === "done" ? "Refresh" : "Load stats"}
        </button>
      </div>

      {state === "idle" && (
        <div className="rounded-xl border border-dashed border-white/[0.06] py-8 text-center text-xs text-zinc-600">
          Click &ldquo;Load stats&rdquo; to fetch Telegraph view counts
        </div>
      )}

      {state === "loading" && (
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/30 py-8 text-center text-xs text-zinc-600">
          Fetching views from telegra.ph API…
        </div>
      )}

      {state === "done" && data?.error && (
        <p className="text-sm text-red-400">{data.error}</p>
      )}

      {state === "done" && data && !data.error && (
        <>
          {data.stats.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.06] py-8 text-center text-xs text-zinc-600">
              No articles with Telegraph URL yet
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                    {["#", "Article", "Cat", "Views", "Age"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.stats.map((stat, i) => (
                    <tr key={stat.slug} className="group transition hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-sm font-black tabular-nums text-zinc-700">
                        {String(i + 1).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-3 max-w-[320px]">
                        <a
                          href={stat.telegraphUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-1 text-xs font-medium text-zinc-200 transition hover:text-cyan-300"
                        >
                          {stat.title}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">
                          {CATEGORY_EMOJI[stat.category] ?? "📰"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold tabular-nums ${stat.views > 100 ? "text-emerald-400" : stat.views > 20 ? "text-cyan-400" : "text-zinc-400"}`}>
                          {stat.views.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[10px] text-zinc-600">
                        {timeAgo(stat.publishedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary bar */}
              <div className="border-t border-white/[0.04] bg-zinc-900/40 px-4 py-3">
                <div className="flex items-center gap-6 text-[10px] text-zinc-600">
                  <span>Top article: <span className="text-zinc-400">{data.stats[0]?.views.toLocaleString() ?? 0} views</span></span>
                  <span>Avg: <span className="text-zinc-400">{data.stats.length > 0 ? Math.round(data.totalViews / data.totalArticles) : 0} views/article</span></span>
                  <span>Total: <span className="text-emerald-400 font-semibold">{data.totalViews.toLocaleString()}</span></span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
