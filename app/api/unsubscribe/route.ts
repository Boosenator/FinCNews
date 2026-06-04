import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { BASE_URL } from "@/lib/config";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/", BASE_URL));

  const db = supabaseAdmin();
  await db
    .from("subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("confirm_token", token);

  return NextResponse.redirect(new URL("/unsubscribed", BASE_URL));
}
