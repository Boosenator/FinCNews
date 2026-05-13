"use client";

import type { RunLog } from "@/lib/supabase";
import RunButton from "./RunButton";
import AutoRefresh from "./AutoRefresh";

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmt(ms: number | null) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function badge(status: RunLog["status"]) {
  const map = {
    success: "bg-emerald-500/15 text-emerald-400",
    error:   "bg-red-500/15 text-red-400",
    running: "bg-amber-500/15 text-amber-400 animate-pulse",
    partial: "bg-orange-500/15 text-orange-400",
  };
  return map[status] ?? "bg-zinc-700 text-zinc-400";
}

function scoreBadge(score?: number) {
  if (!score) return null;
  const cls = score >= 70 ? "bg-emerald-500/15 text-emerald-400"
    : score >= 50 ? "bg-cyan-500/15 text-cyan-400"
    : "bg-zinc-700/50 text-zinc-500";
  return <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${cls}`}>{score}</span>;
}

type Props = {
  logs: RunLog[];
  queuePending: number;
  queueTotal: number;
  stats: { lastRun: RunLog | null; todayPublished: number; activeSources: number };
  totalProcessed: number;
};

export default function LogsTab({ logs, queuePending, queueTotal, stats, totalProcessed }: Props) {
  const { lastRun, todayPublished, activeSources } = stats;

  return (
    <div className="space-y-8">
      {/* Top bar: stats + run button */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Content Flows</h1>
          <p className="mt-1 text-sm text-zinc-500">RSS → Claude → Sanity → Telegraph → Telegram</p>
          <div className="mt-2"><AutoRefresh intervalMs={20000} /></div>
        </div>
        <RunButton />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Last run",       value: lastRun ? timeAgo(lastRun.started_at) : "Never", sub: lastRun?.status ?? "—", color: lastRun?.status === "success" ? "text-emerald-400" : "text-zinc-400" },
          { label: "Published today",value: String(todayPublished), sub: "articles", color: "text-white" },
          { label: "Queue pending",  value: String(queuePending), sub: `of ${queueTotal} total`, color: queuePending > 10 ? "text-amber-400" : "text-white" },
          { label: "Active sources", value: String(activeSources), sub: "RSS feeds", color: "text-white" },
          { label: "Total published",value: String(totalProcessed), sub: "all time", color: "text-white" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{s.label}</p>
            <p className={`mt-1.5 text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-zinc-600">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Run history */}
      <section>
        <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
          <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
          Run History
        </h2>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                {["Time", "Status", "Raw", "Keywords", "New", "Score≥45", "Published", "Dur"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {logs.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-600">No runs yet</td></tr>
              ) : logs.map((log) => {
                const r = log as unknown as Record<string, number>;
                return (
                  <tr key={log.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-3 text-xs tabular-nums text-zinc-400">{timeAgo(log.started_at)}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badge(log.status)}`}>{log.status}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-zinc-500 text-xs">{log.articles_found || "—"}</td>
                    <td className="px-3 py-3 tabular-nums text-zinc-400 text-xs">{r.articles_after_keywords || "—"}</td>
                    <td className="px-3 py-3 tabular-nums text-zinc-400 text-xs">{r.articles_after_url_dedup || "—"}</td>
                    <td className="px-3 py-3 tabular-nums text-zinc-300 text-xs">{r.articles_after_semantic_dedup || "—"}</td>
                    <td className="px-3 py-3 tabular-nums font-semibold text-emerald-400">{log.articles_published}</td>
                    <td className="px-3 py-3 tabular-nums text-zinc-600 text-xs">{fmt(log.duration_ms)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Last run article detail */}
      {logs[0]?.details && logs[0].details.length > 0 && (
        <section>
          <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
            Last Run — {logs[0].details.length} processed
          </h2>
          <div className="space-y-3">
            {logs[0].details.map((d, i) => (
              <div key={i} className={`rounded-xl border p-4 ${d.status === "published" ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/15 bg-red-500/5"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${d.status === "published" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {d.status}
                      </span>
                      {d.category && <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-zinc-400">{d.category}</span>}
                      {scoreBadge((d as { score?: number }).score)}
                      {(d as { imageAttached?: boolean }).imageAttached && <span className="text-[10px] text-cyan-400">📷</span>}
                    </div>
                    <p className="text-sm font-semibold text-zinc-100">{d.title ?? "—"}</p>
                    {(d as { excerpt?: string }).excerpt && (
                      <p className="mt-1 text-[11px] leading-5 text-zinc-500 line-clamp-2">{(d as { excerpt?: string }).excerpt}</p>
                    )}
                    {d.error && <p className="mt-1 text-[11px] text-red-400">{d.error}</p>}
                  </div>
                  {d.slug && d.category && (
                    <a href={`/${d.category}/${d.slug}`} target="_blank" rel="noreferrer"
                      className="shrink-0 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[10px] text-zinc-500 hover:text-cyan-400">
                      View →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
