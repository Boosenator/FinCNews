import Link from "next/link";
import { supabaseAdmin, type RssSource, type RunLog } from "@/lib/supabase";
import FlowsShell from "./_components/FlowsShell";

async function getData() {
  const db = supabaseAdmin();

  // Mark stale "running" logs (>5min old) as error
  await db.from("run_logs")
    .update({ status: "error", error_text: "Timed out", finished_at: new Date().toISOString() })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  const [{ data: sources }, { data: logs }, { count: totalProcessed }, { data: queue }] = await Promise.all([
    db.from("rss_sources").select("*").order("name"),
    db.from("run_logs").select("*").order("started_at", { ascending: false }).limit(20),
    db.from("processed_urls").select("*", { count: "exact", head: true }),
    db.from("article_queue").select("status"),
  ]);

  const logList = (logs ?? []) as RunLog[];

  return {
    sources: (sources ?? []) as RssSource[],
    logs: logList,
    totalProcessed: totalProcessed ?? 0,
    queuePending: (queue ?? []).filter((q: { status: string }) => q.status === "pending").length,
    queueTotal: (queue ?? []).length,
    stats: {
      lastRun: logList[0] ?? null,
      todayPublished: logList
        .filter((l) => new Date(l.started_at).toDateString() === new Date().toDateString())
        .reduce((sum, l) => sum + l.articles_published, 0),
      activeSources: (sources ?? []).filter((s: RssSource) => s.enabled).length,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const { sources, logs, totalProcessed, queuePending, queueTotal, stats } = await getData();

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

      <FlowsShell
        sources={sources}
        logs={logs}
        totalProcessed={totalProcessed}
        queuePending={queuePending}
        queueTotal={queueTotal}
        stats={stats}
      />
    </div>
  );
}
