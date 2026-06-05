import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { isAuthed } from "@/lib/auth";
import { breakingEmail, digestEmail, listUnsubscribeHeaders, type DigestArticle } from "@/lib/emails";
import { BASE_URL, EMAIL_FROM_NEWS, EMAIL_REPLY_TO } from "@/lib/config";

// Send a campaign to all confirmed subscribers
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: campaign } = await db
    .from("email_campaigns")
    .select("*")
    .eq("id", params.id)
    .eq("status", "draft")
    .single();

  if (!campaign) return NextResponse.json({ error: "Campaign not found or already sent" }, { status: 404 });

  const { data: subscribers } = await db
    .from("subscribers")
    .select("email, confirm_token")
    .eq("status", "confirmed");

  if (!subscribers?.length) {
    return NextResponse.json({ error: "No confirmed subscribers" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    try {
      let html: string, text: string, subject: string;

      if (campaign.type === "breaking") {
        ({ html, text } = breakingEmail({
          headline: campaign.headline,
          excerpt: campaign.excerpt,
          articleUrl: campaign.article_url,
          token: sub.confirm_token,
          baseUrl: BASE_URL,
        }));
        subject = campaign.subject;
      } else {
        ({ html, text } = digestEmail({
          weekLabel: campaign.headline,
          articles: campaign.articles as DigestArticle[],
          token: sub.confirm_token,
          baseUrl: BASE_URL,
        }));
        subject = campaign.subject;
      }

      const from = campaign.type === "breaking" ? EMAIL_FROM_NEWS : EMAIL_FROM_NEWS;
      const { error } = await resend.emails.send({
        from,
        replyTo: EMAIL_REPLY_TO,
        to: sub.email,
        subject,
        html,
        text,
        headers: listUnsubscribeHeaders(sub.confirm_token, BASE_URL),
      });

      if (error) {
        failed++;
        await db.from("email_logs").insert({
          type: campaign.type,
          recipient: sub.email,
          subject,
          status: "failed",
          error: String(error),
        });
      } else {
        sent++;
        await db.from("email_logs").insert({
          type: campaign.type,
          recipient: sub.email,
          subject,
          status: "sent",
        });
      }
    } catch {
      failed++;
    }
  }

  await db.from("email_campaigns").update({
    status: "sent",
    sent_at: new Date().toISOString(),
    recipients_count: sent,
  }).eq("id", params.id);

  return NextResponse.json({ ok: true, sent, failed, total: subscribers.length });
}

// Reject a draft campaign
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAuthed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = supabaseAdmin();
  await db.from("email_campaigns").update({
    status: "rejected",
    rejected_at: new Date().toISOString(),
  }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
