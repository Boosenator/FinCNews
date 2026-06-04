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

  const SUBJECT = "Welcome to FinCNews — you're in!";
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent, error: mailError } = await resend.emails.send({
    from: EMAIL_FROM_TECH,
    to: data.email,
    subject: SUBJECT,
    html: welcomeEmail(data.confirm_token, BASE_URL),
  });

  await db.from("email_logs").insert({
    type: "welcome",
    recipient: data.email,
    subject: SUBJECT,
    status: mailError ? "failed" : "sent",
    resend_id: sent?.id ?? null,
    error: mailError ? String(mailError) : null,
  });

  return NextResponse.redirect(new URL("/subscribed", BASE_URL));
}
