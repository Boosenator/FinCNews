import { NextRequest, NextResponse } from "next/server";
import { runCollect } from "@/lib/automation";
import { supabaseAdmin } from "@/lib/supabase";
import { getPipelineConfig } from "@/lib/pipeline-config";

export const maxDuration = 30;

function isAuthed(req: NextRequest) {
  return process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

async function handle(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getPipelineConfig();
  if (!config.collect_enabled) {
    return NextResponse.json({ ok: true, skipped: true, reason: "collect paused" });
  }

  const db = supabaseAdmin();
  const { data: log } = await db.from("run_logs").insert({ status: "running", run_type: "collect" }).select().single();
  if (!log) return NextResponse.json({ error: "Failed to create log" }, { status: 500 });

  try {
    const result = await runCollect({ minScore: config.min_score });

    await db.from("run_logs").update({
      run_type: "collect",
      status: "success",
      finished_at: new Date().toISOString(),
      articles_found: result.itemsFound,
      articles_published: result.itemsQueued,
      articles_skipped: result.itemsSkipped,
      duration_ms: result.durationMs,
      steps: result.steps,
      details: [],
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
