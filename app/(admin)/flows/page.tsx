import { supabaseAdmin, type RssSource, type RunLog } from "@/lib/supabase";
import AdminNav from "./_components/AdminNav";
import DashboardShell from "./_components/DashboardShell";

export const dynamic = "force-dynamic";

async function getData() {
  const db = supabaseAdmin();

  // Mark stale "running" logs (>5 min) as error
  await db
    .from("run_logs")
    .update({ status: "error", error_text: "Timed out", finished_at: new Date().toISOString() })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  const [
    { data: sources },
    { data: logs },
    { count: totalProcessed },
    { data: queue },
    { data: recentQueue },
    { data: elenaRuns },
  ] = await Promise.all([
    db.from("rss_sources").select("*").order("name"),
    db.from("run_logs").select("*").order("started_at", { ascending: false }).limit(20),
    db.from("processed_urls").select("*", { count: "exact", head: true }),
    db.from("article_queue").select("status"),
    db
      .from("article_queue")
      .select("id, score, title, source_url, status, created_at")
      .eq("status", "pending")
      .order("score", { ascending: false })
      .limit(5),
    db
      .from("persona_runs")
      .select("should_write, score, reasoning, topic, article_slug, created_at")
      .eq("persona_id", "elena-voss")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const logList = (logs ?? []) as RunLog[];
  const today   = new Date().toDateString();

  return {
    sources:      (sources ?? []) as RssSource[],
    logs:         logList,
    totalProcessed: totalProcessed ?? 0,
    queuePending: (queue ?? []).filter((q: { status: string }) => q.status === "pending").length,
    queueTotal:   (queue ?? []).length,
    recentQueue:  (recentQueue ?? []) as {
      id: string; score: number | null; title?: string | null;
      source_url?: string | null; status: string; created_at: string;
    }[],
    elenaLastRun: (elenaRuns?.[0] ?? null) as {
      should_write: boolean; score: number; reasoning: string;
      topic: string | null; article_slug: string | null; created_at: string;
    } | null,
    stats: {
      lastRun:        logList[0] ?? null,
      todayPublished: logList
        .filter((l) => new Date(l.started_at).toDateString() === today)
        .reduce((sum, l) => sum + l.articles_published, 0),
      activeSources:  (sources ?? []).filter((s: RssSource) => s.enabled).length,
    },
  };
}

export default async function DashboardPage() {
  const {
    sources, logs, totalProcessed, queuePending, queueTotal,
    recentQueue, elenaLastRun, stats,
  } = await getData();

  return (
    <div className="min-h-screen bg-zinc-950">
      <AdminNav />
      <DashboardShell
        logs={logs}
        totalProcessed={totalProcessed}
        queuePending={queuePending}
        queueTotal={queueTotal}
        recentQueue={recentQueue}
        elenaLastRun={elenaLastRun}
        stats={stats}
      />
    </div>
  );
}
