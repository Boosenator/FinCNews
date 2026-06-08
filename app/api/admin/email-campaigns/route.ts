import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAuthed } from "@/lib/auth";
import { runEmailPlannerAgent } from "@/lib/email-planner-agent";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  const [{ data: campaigns }, { count: confirmedCount }] = await Promise.all([
    db.from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    db.from("subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed"),
  ]);

  return NextResponse.json({
    campaigns: campaigns ?? [],
    confirmedSubscribers: confirmedCount ?? 0,
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await runEmailPlannerAgent();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
