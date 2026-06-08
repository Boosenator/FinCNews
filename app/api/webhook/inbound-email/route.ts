import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";

const DOMAIN = "e.finc.news";

type InboundWebhookPayload = {
  type?: string;
  data?: { email_id?: string; from?: string; to?: string[]; subject?: string };
};

type ResendReceivedEmail = {
  id: string; from?: string; to?: string[];
  subject?: string; html?: string; text?: string;
};

type EmailRoute = {
  id: string; recipient: string; forward_to: string;
  label: string | null; is_active: boolean;
};

async function loadRoutes(): Promise<EmailRoute[]> {
  try {
    const db = supabaseAdmin();
    const { data } = await db
      .from("email_routes")
      .select("id, recipient, forward_to, label, is_active")
      .eq("is_active", true);
    return (data ?? []) as EmailRoute[];
  } catch {
    return [];
  }
}

function resolveRoute(routes: EmailRoute[], mailbox: string): EmailRoute | null {
  const exact   = routes.find((r) => r.recipient === mailbox && r.forward_to);
  const wildcard = routes.find((r) => r.recipient === "*"    && r.forward_to);
  return exact ?? wildcard ?? null;
}

function mailboxFromAddress(address: string): string {
  return address.split("@")[0]?.toLowerCase() ?? address;
}

function formatSubject(mailbox: string, original: string): string {
  return `[finc.news > ${mailbox}] ${original}`;
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.RESEND_INBOUND_SECRET || secret !== process.env.RESEND_INBOUND_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: InboundWebhookPayload;
  try {
    payload = await req.json() as InboundWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[inbound-email] payload:", JSON.stringify(payload));

  if (payload.type !== "email.received" || !payload.data?.email_id) {
    console.log("[inbound-email] skipped — type:", payload.type, "data.email_id:", payload.data?.email_id);
    return NextResponse.json({ ok: true, skipped: "not email.received" });
  }

  const { email_id: emailId, from: fromAddress = "unknown", to: toList = [], subject = "(no subject)" } = payload.data;
  const toAddress = toList[0] ?? "";
  const mailbox   = mailboxFromAddress(toAddress);

  const db      = supabaseAdmin();
  const routes  = await loadRoutes();
  const route   = resolveRoute(routes, mailbox);

  // No route or empty forward_to — skip and log
  if (!route) {
    await db.from("inbound_email_logs").insert({
      from_address: fromAddress,
      to_address:   toAddress || `(unknown@${DOMAIN})`,
      subject,
      status:       "skipped",
      skip_reason:  "no active route",
    });
    console.log(`[inbound-email] No route for "${mailbox}" — skipped`);
    return NextResponse.json({ ok: true, skipped: "no route" });
  }

  // Fetch full email body from Resend API (webhook has metadata only)
  const contentRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  });

  if (!contentRes.ok) {
    await db.from("inbound_email_logs").insert({
      from_address: fromAddress,
      to_address:   toAddress,
      subject,
      forwarded_to: route.forward_to,
      status:       "failed",
      skip_reason:  `Resend API ${contentRes.status}`,
    });
    return NextResponse.json({ ok: false, error: `Resend API ${contentRes.status}` }, { status: 500 });
  }

  const email    = await contentRes.json() as ResendReceivedEmail;
  const resend   = new Resend(process.env.RESEND_API_KEY);
  const fwdSubject = formatSubject(mailbox, email.subject ?? subject);

  const { error } = await resend.emails.send({
    from:    `FinCNews Inbound <tech@${DOMAIN}>`,
    to:      route.forward_to,
    replyTo: fromAddress,
    subject: fwdSubject,
    html:    email.html || `<pre style="font-family:sans-serif;white-space:pre-wrap">${email.text ?? "(empty)"}</pre>`,
    text:    email.text || "(no plain text body)",
    headers: {
      "X-Forwarded-To":   toAddress   || "",
      "X-Forwarded-From": fromAddress || "",
    },
  });

  const status = error ? "failed" : "forwarded";

  await db.from("inbound_email_logs").insert({
    from_address: fromAddress,
    to_address:   toAddress,
    subject:      fwdSubject,
    forwarded_to: route.forward_to,
    status,
    skip_reason:  error ? String(error) : null,
  });

  if (error) {
    console.error("[inbound-email] Forward error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }

  console.log(`[inbound-email] ${toAddress} → ${route.forward_to} | from: ${fromAddress}`);
  return NextResponse.json({ ok: true });
}
