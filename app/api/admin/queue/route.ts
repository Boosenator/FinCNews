import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAuthed } from "@/lib/auth";

// GET — list queue items
export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  await db
    .from("article_queue")
    .update({ status: "pending", error_text: "Reset from stale processing state" })
    .eq("status", "processing")
    .lt("queued_at", new Date(Date.now() - 15 * 60 * 1000).toISOString());

  const { data, error } = await db
    .from("article_queue")
    .select("id, url, title, snippet, source_category, source_name, pub_date, queued_at, status, score, error_text")
    .eq("status", status)
    .order("score", { ascending: false })
    .order("queued_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

// DELETE — clear all pending
export async function DELETE(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { error, count } = await db
    .from("article_queue")
    .delete({ count: "exact" })
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}
