import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { welcomeEmail } from "@/lib/emails";
import { BASE_URL, EMAIL_FROM_TECH } from "@/lib/config";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/", BASE_URL));

  const db = supabaseAdmin();
  const { data } = await db
    .from("subscribers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("confirm_token", token)
    .eq("status", "pending")
    .select("email, confirm_token")
    .single();

  if (!data) {
    // Already confirmed or invalid token — redirect to home silently
    return NextResponse.redirect(new URL("/subscribed?already=1", BASE_URL));
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: EMAIL_FROM_TECH,
    to: data.email,
    subject: "Welcome to FinCNews — you're in!",
    html: welcomeEmail(data.confirm_token, BASE_URL),
  });

  return NextResponse.redirect(new URL("/subscribed", BASE_URL));
}
