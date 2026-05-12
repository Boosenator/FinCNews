import { NextRequest, NextResponse } from "next/server";
import { runCollect } from "@/lib/automation";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

function isAuthed(req: NextRequest) {
  return process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

async function handle(req: NextRequest) {
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
      details: [{ type: "collect", ...result }],
    }).eq("id", log.id);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    await db.from("run_logs").update({ status: "error", finished_at: new Date().toISOString(), error_text: String(e) }).eq("id", log.id);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
