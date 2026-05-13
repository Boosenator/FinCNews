"use client";

import type { RssSource, RunLog } from "@/lib/supabase";
import TelegraphStats from "./TelegraphStats";

const CATEGORY_EMOJI: Record<string, string> = {
  crypto: "₿", markets: "📈", economy: "🏦",
  fintech: "⚡", policy: "⚖️", companies: "🏢",
};

type Props = {
  sources: RssSource[];
  logs: RunLog[];
};

export default function AnalyticsTab({ sources, logs }: Props) {
  // Category breakdown from log details
  const categoryMap: Record<string, { published: number; failed: number }> = {};
  for (const log of logs) {
    if (!log.details) continue;
    for (const d of log.details) {
      const cat = d.category ?? "unknown";
      if (!categoryMap[cat]) categoryMap[cat] = { published: 0, failed: 0 };
      if (d.status === "published") categoryMap[cat].published++;
      else categoryMap[cat].failed++;
    }
  }
  const categories = Object.entries(categoryMap)
    .map(([name, v]) => ({ name, ...v, total: v.published + v.failed }))
    .sort((a, b) => b.published - a.published);

  // Run success rate
  const totalRuns = logs.length;
  const successRuns = logs.filter((l) => l.status === "success").length;
  const partialRuns = logs.filter((l) => l.status === "partial").length;
  const errorRuns = logs.filter((l) => l.status === "error").length;
  const totalPublished = logs.reduce((s, l) => s + l.articles_published, 0);
  const avgPerRun = totalRuns > 0 ? (totalPublished / totalRuns).toFixed(1) : "0";

  // Source activity — enabled vs disabled
  const enabledSources = sources.filter((s) => s.enabled).length;

  // Avg duration
  const runsWithDuration = logs.filter((l) => l.duration_ms);
  const avgDuration = runsWithDuration.length > 0
    ? Math.round(runsWithDuration.reduce((s, l) => s + (l.duration_ms ?? 0), 0) / runsWithDuration.length / 1000)
    : 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-black text-white">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500">Performance metrics across last {totalRuns} runs</p>
      </div>

      {/* Pipeline health */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Success rate", value: totalRuns > 0 ? `${Math.round((successRuns / totalRuns) * 100)}%` : "—", sub: `${successRuns} of ${totalRuns} runs`, color: successRuns / totalRuns >= 0.8 ? "text-emerald-400" : "text-amber-400" },
          { label: "Avg published", value: avgPerRun, sub: "articles per run", color: "text-white" },
          { label: "Avg duration", value: `${avgDuration}s`, sub: "per run", color: "text-white" },
          { label: "Active sources", value: String(enabledSources), sub: `of ${sources.length} total`, color: "text-white" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-zinc-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Run status breakdown */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Run Status Breakdown
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Success", count: successRuns, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
            { label: "Partial", count: partialRuns, cls: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
            { label: "Error", count: errorRuns, cls: "bg-red-500/15 text-red-400 border-red-500/20" },
          ].map((s) => (
            <div key={s.label} className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${s.cls}`}>
              <span className="text-2xl font-black tabular-nums">{s.count}</span>
              <span className="text-sm font-semibold">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Category breakdown */}
      {categories.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
            Published by Category
          </h2>
          <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                  {["Category", "Published", "Failed", "Total", "Hit rate"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {categories.map((c) => {
                  const hitRate = c.total > 0 ? Math.round((c.published / c.total) * 100) : 0;
                  return (
                    <tr key={c.name} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                          <span>{CATEGORY_EMOJI[c.name] ?? "📰"}</span>
                          {c.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-emerald-400">{c.published}</td>
                      <td className="px-4 py-3 tabular-nums text-red-400/70">{c.failed}</td>
                      <td className="px-4 py-3 tabular-nums text-zinc-400">{c.total}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={`h-full rounded-full ${hitRate >= 70 ? "bg-emerald-500" : hitRate >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${hitRate}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-zinc-500">{hitRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Telegraph stats */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Telegraph Performance
        </h2>
        <TelegraphStats />
      </section>
    </div>
  );
}
