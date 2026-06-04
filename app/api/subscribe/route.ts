import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { confirmationEmail } from "@/lib/emails";
import { BASE_URL, EMAIL_FROM_TECH } from "@/lib/config";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let email: string;
  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  email = email.toLowerCase().trim();

  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("subscribers")
    .select("id, status, confirm_token")
    .eq("email", email)
    .maybeSingle();

  let token: string;

  if (existing) {
    if (existing.status === "confirmed") {
      return NextResponse.json({ message: "already_subscribed" });
    }

    if (existing.status === "unsubscribed") {
      const newToken = crypto.randomUUID();
      const { error } = await db
        .from("subscribers")
        .update({ status: "pending", confirm_token: newToken, unsubscribed_at: null })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: "DB error" }, { status: 500 });
      token = newToken;
    } else {
      token = existing.confirm_token;
    }
  } else {
    const { data: created, error } = await db
      .from("subscribers")
      .insert({ email })
      .select("confirm_token")
      .single();
    if (error || !created) return NextResponse.json({ error: "DB error" }, { status: 500 });
    token = created.confirm_token;
  }

  const confirmUrl = `${BASE_URL}/api/confirm?token=${token}`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error: mailError } = await resend.emails.send({
    from: EMAIL_FROM_TECH,
    to: email,
    subject: "Confirm your FinCNews subscription",
    html: confirmationEmail(confirmUrl),
  });

  if (mailError) {
    console.error("[subscribe] Resend error:", mailError);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ message: "confirmation_sent" });
}
