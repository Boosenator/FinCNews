import { NextRequest, NextResponse } from "next/server";
import { runCollect } from "@/lib/automation";
import { supabaseAdmin } from "@/lib/supabase";
import { getPipelineConfig } from "@/lib/pipeline-config";

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getPipelineConfig();
  const db = supabaseAdmin();
  const { data: log } = await db.from("run_logs").insert({ status: "running", run_type: "collect" }).select().single();

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
    }).eq("id", log?.id);

    return NextResponse.json(result);
  } catch (e) {
    await db.from("run_logs").update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_text: String(e),
    }).eq("id", log?.id);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
