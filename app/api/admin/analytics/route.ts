import { NextRequest, NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: generateLogs },
    { data: collectLogs },
    { count: allTimePubs },
    { data: elenaRuns },
    { data: sources },
  ] = await Promise.all([
    // Last 30 days of generate runs — for publication stats + category breakdown
    db.from("run_logs")
      .select("status, articles_published, articles_found, duration_ms, details, started_at")
      .eq("run_type", "generate")
      .gte("started_at", since30d)
      .order("started_at", { ascending: false })
      .limit(200),
    // Last 7 days of collect runs — for pipeline health
    db.from("run_logs")
      .select("status, articles_found, articles_published, duration_ms, started_at")
      .eq("run_type", "collect")
      .gte("started_at", since7d)
      .order("started_at", { ascending: false })
      .limit(200),
    // All-time published count
    db.from("processed_urls").select("*", { count: "exact", head: true }),
    // Elena persona stats (last 30 days)
    db.from("persona_runs")
      .select("should_write, score, topic, article_slug, created_at, reasoning")
      .eq("persona_id", "elena-voss")
      .gte("created_at", since30d)
      .order("created_at", { ascending: false })
      .limit(100),
    // Sources
    db.from("rss_sources").select("id, name, enabled, articles_published").order("articles_published", { ascending: false }),
  ]);

  // ── Generate pipeline stats ──────────────────────────────
  const genLogs = generateLogs ?? [];
  const genTotal = genLogs.length;
  const genSuccess = genLogs.filter((l) => l.status === "success").length;
  const genPartial = genLogs.filter((l) => l.status === "partial").length;
  const genError   = genLogs.filter((l) => l.status === "error").length;
  const genPublished = genLogs.reduce((s, l) => s + (l.articles_published ?? 0), 0);
  const genDurations = genLogs.filter((l) => l.duration_ms).map((l) => l.duration_ms as number);
  const genAvgDuration = genDurations.length > 0
    ? Math.round(genDurations.reduce((a, b) => a + b, 0) / genDurations.length / 1000)
    : 0;

  // Category breakdown from generate run details
  const categoryMap: Record<string, { published: number; error: number; skipped: number }> = {};
  for (const log of genLogs) {
    if (!Array.isArray(log.details)) continue;
    for (const d of log.details as Array<{ category?: string; status: string }>) {
      const cat = d.category ?? "unknown";
      if (!categoryMap[cat]) categoryMap[cat] = { published: 0, error: 0, skipped: 0 };
      if (d.status === "published") categoryMap[cat].published++;
      else if (d.status === "error") categoryMap[cat].error++;
      else categoryMap[cat].skipped++;
    }
  }
  const categories = Object.entries(categoryMap)
    .map(([name, v]) => ({ name, ...v, total: v.published + v.error + v.skipped }))
    .sort((a, b) => b.published - a.published);

  // ── Collect pipeline stats ───────────────────────────────
  const colLogs = collectLogs ?? [];
  const colTotal = colLogs.length;
  const colSuccess = colLogs.filter((l) => l.status === "success").length;
  const colAvgFound = colTotal > 0
    ? Math.round(colLogs.reduce((s, l) => s + (l.articles_found ?? 0), 0) / colTotal)
    : 0;
  const colAvgQueued = colTotal > 0
    ? Math.round(colLogs.reduce((s, l) => s + (l.articles_published ?? 0), 0) / colTotal)
    : 0;

  // ── Persona stats ────────────────────────────────────────
  const elenaAll = elenaRuns ?? [];
  const elenaWrote = elenaAll.filter((r) => r.should_write || r.article_slug).length;
  const elenaSilent = elenaAll.length - elenaWrote;
  const elenaAvgScore = elenaAll.length > 0
    ? Math.round(elenaAll.reduce((s, r) => s + (r.score ?? 0), 0) / elenaAll.length)
    : 0;
  const elenaPublishedSlugs = elenaAll
    .filter((r) => r.article_slug)
    .map((r) => ({ slug: r.article_slug, topic: r.topic, created_at: r.created_at }))
    .slice(0, 10);

  // ── Source stats ─────────────────────────────────────────
  const srcList = (sources ?? []) as { id: string; name: string; enabled: boolean; articles_published: number }[];
  const topSources = srcList
    .filter((s) => s.articles_published > 0)
    .sort((a, b) => b.articles_published - a.articles_published)
    .slice(0, 8);

  return NextResponse.json({
    generate: {
      total:       genTotal,
      success:     genSuccess,
      partial:     genPartial,
      error:       genError,
      published:   genPublished,
      avgPerRun:   genTotal > 0 ? +(genPublished / genTotal).toFixed(1) : 0,
      avgDuration: genAvgDuration,
      window:      "30 days",
    },
    collect: {
      total:      colTotal,
      success:    colSuccess,
      avgFound:   colAvgFound,
      avgQueued:  colAvgQueued,
      window:     "7 days",
    },
    categories,
    personas: {
      "elena-voss": {
        total:       elenaAll.length,
        wrote:       elenaWrote,
        silent:      elenaSilent,
        avgScore:    elenaAvgScore,
        publishRate: elenaAll.length > 0 ? Math.round((elenaWrote / elenaAll.length) * 100) : 0,
        recentArticles: elenaPublishedSlugs,
        window:      "30 days",
      },
    },
    sources: {
      total:   srcList.length,
      enabled: srcList.filter((s) => s.enabled).length,
      top:     topSources,
    },
    allTimePubs: allTimePubs ?? 0,
  });
}
