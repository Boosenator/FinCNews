import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { isAuthed } from "@/lib/auth";
import { breakingEmail, digestEmail, listUnsubscribeHeaders, type DigestArticle } from "@/lib/emails";
import { BASE_URL, EMAIL_FROM_TECH, EMAIL_FROM_NEWS, EMAIL_REPLY_TO } from "@/lib/config";

export const maxDuration = 300;

const BATCH_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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
  const from = campaign.type === "breaking" ? EMAIL_FROM_TECH : EMAIL_FROM_NEWS;
  const subject: string = campaign.subject;

  let sent = 0;
  let failed = 0;
  const logRows: object[] = [];

  for (const batch of chunk(subscribers, BATCH_SIZE)) {
    const messages = batch.map((sub) => {
      const { html, text } = campaign.type === "breaking"
        ? breakingEmail({
            headline:   campaign.headline,
            excerpt:    campaign.excerpt,
            articleUrl: campaign.article_url,
            token:      sub.confirm_token,
            baseUrl:    BASE_URL,
          })
        : digestEmail({
            weekLabel: campaign.headline,
            articles:  campaign.articles as DigestArticle[],
            token:     sub.confirm_token,
            baseUrl:   BASE_URL,
          });

      return {
        from,
        replyTo: EMAIL_REPLY_TO,
        to:      sub.email,
        subject,
        html,
        text,
        headers: listUnsubscribeHeaders(sub.confirm_token, BASE_URL),
      };
    });

    const { data: results, error: batchError } = await resend.batch.send(messages);

    if (batchError || !results) {
      failed += batch.length;
      for (const sub of batch) {
        logRows.push({ type: campaign.type, recipient: sub.email, subject, status: "failed", error: String(batchError) });
      }
    } else {
      for (let i = 0; i < batch.length; i++) {
        const r = results[i];
        const ok = r && !("error" in r);
        if (ok) { sent++; } else { failed++; }
        logRows.push({ type: campaign.type, recipient: batch[i].email, subject, status: ok ? "sent" : "failed" });
      }
    }
  }

  await Promise.all([
    db.from("email_logs").insert(logRows),
    db.from("email_campaigns").update({
      status:           "sent",
      sent_at:          new Date().toISOString(),
      recipients_count: sent,
    }).eq("id", params.id),
  ]);

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
    status:      "rejected",
    rejected_at: new Date().toISOString(),
  }).eq("id", params.id);

  return NextResponse.json({ ok: true });
}
