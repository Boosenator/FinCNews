import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAuthed } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("email_routes")
    .select("*")
    .order("recipient", { ascending: true });
  if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
  return NextResponse.json({ routes: data ?? [] });
}

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { recipient, forward_to, label } = await req.json() as {
    recipient?: string; forward_to?: string; label?: string;
  };
  if (!recipient?.trim() || !forward_to?.trim()) {
    return NextResponse.json({ error: "recipient and forward_to required" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("email_routes")
    .upsert({ recipient: recipient.trim().toLowerCase(), forward_to: forward_to.trim(), label: label?.trim() ?? null, is_active: true }, { onConflict: "recipient" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: String(error.message) }, { status: 500 });
  return NextResponse.json({ ok: true, route: data });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, is_active, forward_to } = await req.json() as {
    id?: string; is_active?: boolean; forward_to?: string;
  };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = supabaseAdmin();
  const updates: Record<string, unknown> = {};
  if (is_active !== undefined) updates.is_active = is_active;
  if (forward_to !== undefined) updates.forward_to = forward_to.trim();
  await db.from("email_routes").update(updates).eq("id", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json() as { id?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = supabaseAdmin();
  await db.from("email_routes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
