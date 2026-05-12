import { NextRequest, NextResponse } from "next/server";
import { runAutomation } from "@/lib/automation";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

function isAuthed(req: NextRequest) {
  const auth = req.headers.get("authorization");
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function handle(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: log } = await db.from("run_logs").insert({ status: "running" }).select().single();
  if (!log) return NextResponse.json({ error: "Failed to create log" }, { status: 500 });

  try {
    const result = await runAutomation(3);
    const hasError = result.details.some((d) => d.status === "error");
    const status = result.articlesPublished > 0 ? "success" : hasError ? "partial" : "success";

    // Core fields
    await db.from("run_logs").update({
      status,
      finished_at: new Date().toISOString(),
      articles_found: result.articlesFound,
      articles_published: result.articlesPublished,
      articles_skipped: result.articlesSkipped,
      duration_ms: result.durationMs,
      details: result.details,
    }).eq("id", log.id);

    // Extended fields (requires migration_001.sql)
    void db.from("run_logs").update({
      articles_after_keywords: result.articlesAfterKeywords,
      articles_after_url_dedup: result.articlesAfterUrlDedup,
      articles_after_semantic_dedup: result.articlesAfterSemanticDedup,
    }).eq("id", log.id);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await db.from("run_logs").update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_text: String(e),
    }).eq("id", log.id);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
