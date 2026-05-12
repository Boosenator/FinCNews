import { NextRequest, NextResponse } from "next/server";
import { runAutomation } from "@/lib/automation";
import { supabaseAdmin } from "@/lib/supabase";

function isAuthed(req: NextRequest) {
  const cookie = req.cookies.get("admin_key")?.value;
  return cookie === process.env.ADMIN_KEY;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: log } = await db.from("run_logs").insert({ status: "running" }).select().single();

  try {
    const result = await runAutomation(3);

    await db.from("run_logs").update({
      status: result.articlesPublished > 0 ? "success" : result.details.some((d) => d.status === "error") ? "partial" : "success",
      finished_at: new Date().toISOString(),
      articles_found: result.articlesFound,
      articles_published: result.articlesPublished,
      articles_skipped: result.articlesSkipped,
      duration_ms: result.durationMs,
      details: result.details,
    }).eq("id", log.id);

    return NextResponse.json(result);
  } catch (e) {
    await db.from("run_logs").update({
      status: "error",
      finished_at: new Date().toISOString(),
      error_text: String(e),
    }).eq("id", log.id);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
