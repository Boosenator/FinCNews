import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

// Emails at finc.news that we want to forward
const ALLOWED_RECIPIENTS = new Set([
  "editorial@finc.news",
  "privacy@finc.news",
  "legal@finc.news",
  "ads@finc.news",
  "tech@finc.news",
]);

export async function POST(req: NextRequest) {
  // Auth: Resend sends ?secret=... in the webhook URL we configure in their dashboard
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.RESEND_INBOUND_SECRET || secret !== process.env.RESEND_INBOUND_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forwardTo = process.env.INBOUND_FORWARD_TO;
  if (!forwardTo) {
    console.error("[inbound-email] INBOUND_FORWARD_TO not set");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resend inbound payload shape: { type: "email.received", data: { from, to, subject, text, html, ... } }
  // Fall back to flat shape just in case
  const data = (payload.data ?? payload) as Record<string, unknown>;

  const rawFrom = data.from as string | { email: string; name?: string } | undefined;
  const fromEmail = typeof rawFrom === "string" ? rawFrom : (rawFrom?.email ?? "unknown@unknown");
  const fromName  = typeof rawFrom === "object"  ? (rawFrom?.name ?? "") : "";

  const rawTo = data.to as string | string[] | Array<{ email: string }> | undefined;
  const toEmail = Array.isArray(rawTo)
    ? (typeof rawTo[0] === "string" ? rawTo[0] : (rawTo[0] as { email: string })?.email ?? "")
    : (rawTo as string ?? "");

  const subject = (data.subject as string | undefined) ?? "(no subject)";
  const html    = (data.html as string | undefined)    ?? "";
  const text    = (data.text as string | undefined)    ?? "";

  // Only forward to known addresses — drop anything else (spam trap, etc.)
  if (toEmail && !ALLOWED_RECIPIENTS.has(toEmail.toLowerCase())) {
    console.log(`[inbound-email] Ignored recipient: ${toEmail}`);
    return NextResponse.json({ ok: true, skipped: "unknown recipient" });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const displayFrom = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  const { error } = await resend.emails.send({
    from:    "FinCNews Inbound <tech@e.finc.news>",
    to:      forwardTo,
    replyTo: fromEmail,   // reply goes directly to the original sender
    subject: `[${toEmail || "finc.news"}] ${subject}`,
    html:    html || `<pre style="font-family:sans-serif">${text}</pre>`,
    text:    text || "(no plain text body)",
    headers: {
      "X-Forwarded-To":   toEmail   || "",
      "X-Forwarded-From": displayFrom,
    },
  });

  if (error) {
    console.error("[inbound-email] Resend forward error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }

  console.log(`[inbound-email] Forwarded ${toEmail} → ${forwardTo} (from: ${fromEmail}, subject: ${subject})`);
  return NextResponse.json({ ok: true });
}
