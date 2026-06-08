import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const ALLOWED_RECIPIENTS = new Set([
  "editorial@e.finc.news",
  "privacy@e.finc.news",
  "legal@e.finc.news",
  "ads@e.finc.news",
  "tech@e.finc.news",
]);

type InboundWebhookPayload = {
  type?: string;
  data?: {
    id?:      string;
    from?:    string;
    to?:      string[];
    subject?: string;
  };
};

type ResendReceivedEmail = {
  id:       string;
  from?:    string;
  to?:      string[];
  subject?: string;
  html?:    string;
  text?:    string;
};

export async function POST(req: NextRequest) {
  // Auth: secret appended to webhook URL in Resend dashboard
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.RESEND_INBOUND_SECRET || secret !== process.env.RESEND_INBOUND_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forwardTo = process.env.INBOUND_FORWARD_TO;
  if (!forwardTo) {
    console.error("[inbound-email] INBOUND_FORWARD_TO not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  let payload: InboundWebhookPayload;
  try {
    payload = await req.json() as InboundWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only handle inbound email events
  if (payload.type !== "email.received" || !payload.data?.id) {
    return NextResponse.json({ ok: true, skipped: "not email.received" });
  }

  const { id: emailId, from: fromAddress = "unknown", to: toList = [], subject = "(no subject)" } = payload.data;
  const toAddress = toList[0] ?? "";

  // Drop unknown recipients (spam trap protection)
  if (toAddress && !ALLOWED_RECIPIENTS.has(toAddress.toLowerCase())) {
    console.log(`[inbound-email] Ignored unknown recipient: ${toAddress}`);
    return NextResponse.json({ ok: true, skipped: "unknown recipient" });
  }

  // Fetch full email body from Resend API (webhook payload has metadata only)
  const contentRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });

  if (!contentRes.ok) {
    const errText = await contentRes.text();
    console.error(`[inbound-email] Failed to fetch email ${emailId}: ${contentRes.status} ${errText}`);
    return NextResponse.json({ ok: false, error: `Resend API ${contentRes.status}` }, { status: 500 });
  }

  const email = await contentRes.json() as ResendReceivedEmail;

  // Forward to Gmail via Resend sending API
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from:    "FinCNews Inbound <tech@e.finc.news>",
    to:      forwardTo,
    replyTo: fromAddress,   // reply goes directly to the original sender
    subject: `[${toAddress || "finc.news"}] ${email.subject ?? subject}`,
    html:    email.html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${email.text ?? "(empty)"}</pre>`,
    text:    email.text || "(no plain text body)",
    headers: {
      "X-Forwarded-To":   toAddress    || "",
      "X-Forwarded-From": fromAddress  || "",
    },
  });

  if (error) {
    console.error("[inbound-email] Forward error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }

  console.log(`[inbound-email] Forwarded → ${forwardTo} | to: ${toAddress} | from: ${fromAddress} | subject: ${subject}`);
  return NextResponse.json({ ok: true });
}
