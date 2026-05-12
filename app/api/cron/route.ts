import { NextRequest, NextResponse } from "next/server";
import { runAutomation } from "@/lib/automation";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: log } = await db.from("run_logs").insert({ status: "running" }).select().single();

  try {
    const result = await runAutomation(3);
    const status = result.articlesPublished > 0
      ? "success"
      : result.details.some((d) => d.status === "error") ? "partial" : "success";

    await db.from("run_logs").update({
      status,
      finished_at: new Date().toISOString(),
      articles_found: result.articlesFound,
      articles_published: result.articlesPublished,
      articles_skipped: result.articlesSkipped,
      duration_ms: result.durationMs,
      details: result.details,
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
