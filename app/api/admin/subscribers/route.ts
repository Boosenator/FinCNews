import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAuthed } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();

  const [
    { count: total },
    { count: confirmed },
    { count: pending },
    { count: unsubscribed },
    { data: logs },
    { data: recent },
  ] = await Promise.all([
    db.from("subscribers").select("*", { count: "exact", head: true }),
    db.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
    db.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "unsubscribed"),
    db.from("email_logs").select("*").order("sent_at", { ascending: false }).limit(50),
    db.from("subscribers").select("email, status, confirmed_at, unsubscribed_at, created_at").order("created_at", { ascending: false }).limit(200),
  ]);

  return NextResponse.json({
    stats: {
      total: total ?? 0,
      confirmed: confirmed ?? 0,
      pending: pending ?? 0,
      unsubscribed: unsubscribed ?? 0,
    },
    logs: logs ?? [],
    subscribers: recent ?? [],
  });
}
