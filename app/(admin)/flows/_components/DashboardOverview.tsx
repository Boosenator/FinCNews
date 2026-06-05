"use client";

import RunButton from "./RunButton";
import AutoRefresh from "./AutoRefresh";
import type { RunLog } from "@/lib/supabase";

interface QueueItem {
  id: string;
  score: number | null;
  title?: string | null;
  source_url?: string | null;
  status: string;
  created_at: string;
}

interface ElenaRun {
  should_write: boolean;
  score: number;
  reasoning: string;
  topic: string | null;
  article_slug: string | null;
  created_at: string;
}

type Props = {
  logs: RunLog[];
  queuePending: number;
  queueTotal: number;
  activeSources: number;
  totalProcessed: number;
  todayPublished: number;
  lastRun: RunLog | null;
  recentQueue: QueueItem[];
  elenaLastRun: ElenaRun | null;
};

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

function statusColor(status: RunLog["status"]) {
  return status === "success" ? "text-emerald-400"
    : status === "error"   ? "text-red-400"
    : status === "partial" ? "text-amber-400"
    : "text-zinc-400";
}

export default function DashboardOverview({
  logs, queuePending, queueTotal, activeSources, totalProcessed,
  todayPublished, lastRun, recentQueue, elenaLastRun,
}: Props) {
  const recentLogs = logs.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <div className="mt-1.5"><AutoRefresh intervalMs={20000} /></div>
        </div>
        <RunButton />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([
          { label: "Published today",  value: String(todayPublished),    sub: "articles",                          color: "text-white" },
          { label: "Queue pending",    value: String(queuePending),      sub: `of ${queueTotal} total`,            color: queuePending > 10 ? "text-amber-400" : "text-white" },
          { label: "Active sources",   value: String(activeSources),     sub: "RSS feeds",                         color: "text-white" },
          { label: "Last run",         value: lastRun ? timeAgo(lastRun.started_at) : "Never", sub: lastRun?.status ?? "—", color: lastRun?.status === "success" ? "text-emerald-400" : "text-zinc-400" },
          { label: "Total published",  value: totalProcessed.toLocaleString(), sub: "all time",                   color: "text-white" },
          {
            label: "Elena's stance",
            value: elenaLastRun ? (elenaLastRun.should_write ? "wrote" : "silent") : "—",
            sub: elenaLastRun ? `score ${elenaLastRun.score} · ${timeAgo(elenaLastRun.created_at)}` : "no run",
            color: elenaLastRun?.should_write ? "text-emerald-400" : "text-cyan-400",
          },
        ] as const).map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{s.label}</p>
            <p className={`mt-1.5 text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Recent runs */}
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-600">Recent Runs</p>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-zinc-600">No runs yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {recentLogs.map((log) => {
                const isPersona = log.run_type === ("elena-voss" as RunLog["run_type"]);
                return (
                  <div key={log.id} className="flex items-center gap-3 py-2.5 text-xs">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      log.status === "success" ? "bg-emerald-400"
                      : log.status === "error"   ? "bg-red-400"
                      : log.status === "partial" ? "bg-amber-400"
                      : "bg-zinc-600 animate-pulse"
                    }`} />
                    <span className="w-20 flex-shrink-0 font-semibold text-zinc-300">
                      {isPersona ? "Elena" : log.run_type}
                    </span>
                    <span className="text-zinc-600">{timeAgo(log.started_at)}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      log.status === "success" ? "bg-emerald-500/10 text-emerald-400"
                      : log.status === "error"   ? "bg-red-500/10 text-red-400"
                      : log.status === "partial" ? "bg-amber-500/10 text-amber-400"
                      : "bg-zinc-700 text-zinc-400 animate-pulse"
                    }`}>{log.status}</span>
                    <span className="ml-auto text-zinc-600">
                      {log.run_type === "collect"
                        ? `${log.articles_found ?? 0} found → ${log.articles_published ?? 0} queued`
                        : log.articles_published != null
                          ? `${log.articles_published} published`
                          : ""}
                    </span>
                    <span className="w-10 flex-shrink-0 text-right text-zinc-700">
                      {fmt(log.duration_ms)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Queue preview */}
        <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">
              Queue
              {queuePending > 0 && (
                <span className="ml-2 rounded-full bg-cyan-400/10 px-1.5 py-0.5 text-[10px] font-black text-cyan-400">
                  {queuePending} pending
                </span>
              )}
            </p>
          </div>

          {recentQueue.length === 0 ? (
            <p className="text-sm text-zinc-600">Queue is empty.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {recentQueue.map((item) => {
                const score = item.score ?? 0;
                const scoreColor = score >= 80 ? "bg-emerald-500/15 text-emerald-400"
                  : score >= 60 ? "bg-cyan-500/15 text-cyan-400"
                  : "bg-zinc-800 text-zinc-500";
                const host = (() => {
                  try { return new URL(item.source_url ?? "").hostname.replace("www.", ""); }
                  catch { return ""; }
                })();
                return (
                  <div key={item.id} className="py-2.5">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black tabular-nums ${scoreColor}`}>
                        {score}
                      </span>
                      <p className="flex-1 text-xs font-semibold leading-snug text-zinc-200 line-clamp-2">
                        {item.title ?? item.source_url ?? "(no title)"}
                      </p>
                    </div>
                    <p className="mt-1 pl-8 text-[11px] text-zinc-600">
                      {host && <span>{host} · </span>}
                      {timeAgo(item.created_at)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
