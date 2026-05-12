import { NextRequest, NextResponse } from "next/server";
import { runCollect } from "@/lib/automation";
import { supabaseAdmin } from "@/lib/supabase";

function isAuthed(req: NextRequest) {
  return req.cookies.get("admin_key")?.value === process.env.ADMIN_KEY;
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: log } = await db.from("run_logs").insert({ status: "running" }).select().single();

  try {
    const result = await runCollect();

    await db.from("run_logs").update({
      status: "success",
      finished_at: new Date().toISOString(),
      articles_found: result.itemsFound,
      articles_published: 0,
      articles_skipped: result.itemsSkipped,
      duration_ms: result.durationMs,
      details: [{
        type: "collect",
        sourcesChecked: result.sourcesChecked,
        itemsFound: result.itemsFound,
        itemsAfterKeywords: result.itemsAfterKeywords,
        itemsQueued: result.itemsQueued,
        status: "published",
        url: "collect-run",
      }],
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
