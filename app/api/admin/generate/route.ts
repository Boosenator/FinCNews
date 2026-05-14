import { NextRequest, NextResponse } from "next/server";
import { runGenerate } from "@/lib/automation";
import { supabaseAdmin } from "@/lib/supabase";
import { getPipelineConfig } from "@/lib/pipeline-config";

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getPipelineConfig();
  const db = supabaseAdmin();
  const { data: log } = await db.from("run_logs").insert({ status: "running", run_type: "generate" }).select().single();

  try {
    const result = await runGenerate(config.generate_max_per_run);
    const hasError = result.details.some((d) => d.status === "error");
    const status = result.articlesPublished > 0 ? "success" : hasError ? "partial" : "success";

    await db.from("run_logs").update({
      run_type: "generate",
      status,
      finished_at: new Date().toISOString(),
      articles_found: result.queueSize,
      articles_published: result.articlesPublished,
      articles_skipped: 0,
      duration_ms: result.durationMs,
      details: result.details,
      steps: result.steps,
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
