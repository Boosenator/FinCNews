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
    { data: inboundLogs },
    { data: routes },
  ] = await Promise.all([
    db.from("subscribers").select("*", { count: "exact", head: true }),
    db.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "confirmed"),
    db.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "pending"),
    db.from("subscribers").select("*", { count: "exact", head: true }).eq("status", "unsubscribed"),
    db.from("email_logs").select("*").order("sent_at", { ascending: false }).limit(50),
    db.from("subscribers").select("email, status, confirmed_at, unsubscribed_at, created_at").order("created_at", { ascending: false }).limit(200),
    db.from("inbound_email_logs").select("*").order("received_at", { ascending: false }).limit(100),
    db.from("email_routes").select("*").order("recipient", { ascending: true }),
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
    inboundLogs: inboundLogs ?? [],
    routes: routes ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

  const db = supabaseAdmin();
  const { error } = await db
    .from("subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("email", email)
    .neq("status", "unsubscribed");

  if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
