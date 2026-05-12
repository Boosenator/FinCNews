import Link from "next/link";
import { supabaseAdmin, type RssSource, type RunLog } from "@/lib/supabase";
import RunButton from "./_components/RunButton";
import ToggleSource from "./_components/ToggleSource";
import AddSourceForm from "./_components/AddSourceForm";

function badge(status: RunLog["status"]) {
  const map = {
    success: "bg-emerald-500/15 text-emerald-400",
    error: "bg-red-500/15 text-red-400",
    running: "bg-amber-500/15 text-amber-400",
    partial: "bg-orange-500/15 text-orange-400",
  };
  return map[status] ?? "bg-zinc-700 text-zinc-400";
}

function fmt(ms: number | null) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function getData() {
  const db = supabaseAdmin();
  const [{ data: sources }, { data: logs }, { data: stats }] = await Promise.all([
    db.from("rss_sources").select("*").order("name"),
    db.from("run_logs").select("*").order("started_at", { ascending: false }).limit(20),
    db.from("processed_urls").select("id", { count: "exact", head: true }),
  ]);
  return {
    sources: (sources ?? []) as RssSource[],
    logs: (logs ?? []) as RunLog[],
    totalProcessed: stats ?? 0,
  };
}

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const { sources, logs, totalProcessed } = await getData();

  const lastRun = logs[0];
  const todayPublished = logs
    .filter((l) => new Date(l.started_at).toDateString() === new Date().toDateString())
    .reduce((sum, l) => sum + l.articles_published, 0);
  const activeSources = sources.filter((s) => s.enabled).length;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-zinc-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-xl font-black text-white">
            Fin<span className="text-cyan-400">C</span>News
            <span className="ml-2 text-xs font-normal text-zinc-600">/ Admin</span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="/api/admin/logout" className="text-xs text-zinc-600 hover:text-zinc-400">Sign out</a>
            <Link href="/" className="text-xs text-zinc-500 hover:text-white">← Site</Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Page title + Run button */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Content Flows</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Automation pipeline — RSS → Claude → Sanity → Telegram
            </p>
          </div>
          <RunButton />
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Last run", value: lastRun ? timeAgo(lastRun.started_at) : "Never", sub: lastRun?.status ?? "—", color: lastRun?.status === "success" ? "text-emerald-400" : "text-zinc-500" },
            { label: "Published today", value: String(todayPublished), sub: "articles", color: "text-white" },
            { label: "Active sources", value: String(activeSources), sub: `of ${sources.length} total`, color: "text-white" },
            { label: "Total processed", value: String(totalProcessed), sub: "unique URLs", color: "text-white" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">{stat.label}</p>
              <p className={`mt-1.5 text-2xl font-black tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-zinc-600">{stat.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Run logs */}
          <section>
            <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
              Run History
            </h2>
            <div className="overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                    {["Time", "Status", "Found", "Published", "Duration"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                        No runs yet. Click &ldquo;Run Now&rdquo; to start.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="transition hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-xs tabular-nums text-zinc-400">{timeAgo(log.started_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${badge(log.status)}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-zinc-300">{log.articles_found}</td>
                        <td className="px-4 py-3 tabular-nums text-emerald-400 font-semibold">{log.articles_published}</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-500 text-xs">{fmt(log.duration_ms)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Last run detail */}
            {lastRun?.details && lastRun.details.length > 0 && (
              <details className="mt-4 rounded-xl border border-white/[0.06] bg-zinc-900/30">
                <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-zinc-500 hover:text-zinc-300">
                  Last run — {lastRun.details.length} articles detail
                </summary>
                <div className="divide-y divide-white/[0.04] px-4 pb-3">
                  {lastRun.details.map((d, i) => (
                    <div key={i} className="flex items-start gap-3 py-2.5">
                      <span className={`mt-0.5 shrink-0 text-[10px] font-bold uppercase ${d.status === "published" ? "text-emerald-400" : "text-red-400"}`}>
                        {d.status}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs text-zinc-300">{d.title ?? d.url}</p>
                        {d.slug && <p className="text-[10px] text-zinc-600">/{d.slug}</p>}
                        {d.error && <p className="text-[10px] text-red-400">{d.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </section>

          {/* Sources */}
          <section>
            <h2 className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
              <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
              RSS Sources
            </h2>
            <div className="mb-3 overflow-hidden rounded-xl border border-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-zinc-900/60">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">Source</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">Cat</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-600">Published</th>
                    <th className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600">On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {sources.map((src) => (
                    <tr key={src.id} className={`transition hover:bg-white/[0.02] ${!src.enabled ? "opacity-40" : ""}`}>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-zinc-200">{src.name}</p>
                        <p className="text-[10px] text-zinc-600 truncate max-w-[160px]">{src.url.replace(/^https?:\/\//, "")}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">{src.category}</span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-xs text-zinc-500">{src.articles_published}</td>
                      <td className="px-4 py-2.5 text-center">
                        <ToggleSource id={src.id} enabled={src.enabled} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AddSourceForm />

            {/* Cron config info */}
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-zinc-900/30 p-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-600">External Cron</p>
              <p className="text-xs text-zinc-500 mb-3">
                Set up <a href="https://cron-job.org" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">cron-job.org</a> to call:
              </p>
              <code className="block break-all rounded bg-zinc-800 px-3 py-2 text-[11px] text-zinc-300">
                POST {process.env.NEXT_PUBLIC_BASE_URL}/api/cron
              </code>
              <p className="mt-2 text-[10px] text-zinc-600">
                Header: <span className="text-zinc-400">Authorization: Bearer {"{CRON_SECRET}"}</span>
              </p>
              <p className="mt-1 text-[10px] text-zinc-600">Schedule: every 15 minutes</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
