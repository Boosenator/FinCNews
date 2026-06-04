// ─── Color palette ───────────────────────────────────────────────────────────
// All contrast ratios measured against CARD background (#18181b, lum≈0.009)
const BASE   = "#09090b";  // zinc-950
const CARD   = "#18181b";  // zinc-900
const BORDER = "#27272a";  // zinc-800
const TEXT   = "#a1a1aa";  // zinc-400 — contrast 7.3:1 ✓
const FOOTER = "#a1a1aa";  // zinc-400 — was zinc-600 (#52525b, 2.4:1) — fixed low-contrast flag
const WHITE  = "#f4f4f5";  // zinc-100
const CYAN   = "#22d3ee";  // cyan-400

// ─── Shared helpers ───────────────────────────────────────────────────────────

function shell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FinCNews</title>
</head>
<body style="margin:0;padding:0;background:${BASE};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BASE};padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

        <!-- Header -->
        <tr>
          <td style="padding-bottom:28px;">
            <span style="font-size:18px;font-weight:700;letter-spacing:-0.5px;color:${WHITE};">Fin</span><span style="font-size:18px;font-weight:700;letter-spacing:-0.5px;color:${CYAN};">C</span><span style="font-size:18px;font-weight:700;letter-spacing:-0.5px;color:${WHITE};">News</span>
            <span style="font-size:12px;color:${TEXT};margin-left:8px;">Fast finance intelligence</span>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:${CARD};border:1px solid ${BORDER};border-radius:12px;padding:40px 36px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding-top:24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:${FOOTER};">
              FinCNews — AI-powered finance news covering crypto, markets, macro and fintech.
            </p>
            <p style="margin:0;font-size:11px;color:${FOOTER};">
              You are receiving this email because you subscribed at finc.news
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:28px;padding:13px 28px;background:${CYAN};border-radius:8px;font-size:14px;font-weight:600;color:#000;text-decoration:none;letter-spacing:0.01em;">${label}</a>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:28px 0;" />`;
}

function unsubLink(token: string, baseUrl: string): string {
  return `<a href="${baseUrl}/api/unsubscribe?token=${token}" style="color:${FOOTER};font-size:12px;text-decoration:underline;">Unsubscribe</a>`;
}

export type EmailContent = { html: string; text: string };

// ─── Confirmation (DOI) ──────────────────────────────────────────────────────

export function confirmationEmail(confirmUrl: string): EmailContent {
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${WHITE};letter-spacing:-0.5px;">
      One click to confirm your subscription
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:${TEXT};">
      You requested to subscribe to FinCNews — AI-powered breaking news covering cryptocurrency, financial markets, macroeconomics, and fintech. Click the button below to confirm your subscription and start receiving updates.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:8px;">
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${BORDER};">
          <span style="font-size:13px;color:${CYAN};font-weight:600;">Breaking alerts</span>
          <span style="font-size:13px;color:${TEXT};"> &mdash; Sent when major market events happen</span>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-top:1px solid ${BORDER};">
          <span style="font-size:13px;color:${CYAN};font-weight:600;">Weekly digest</span>
          <span style="font-size:13px;color:${TEXT};"> &mdash; Top finance stories every Friday</span>
        </td>
      </tr>
    </table>

    ${btn(confirmUrl, "Confirm subscription →")}

    ${divider()}

    <p style="margin:0;font-size:13px;color:${FOOTER};line-height:1.7;">
      If you did not request this subscription, you can safely ignore this email. No account will be created and you will not receive any further messages. This confirmation link expires in 24 hours.
    </p>
  `);

  const text = `FinCNews — Confirm your subscription

You requested to subscribe to FinCNews, an AI-powered news service covering cryptocurrency, financial markets, macroeconomics, and fintech.

What you will receive:
- Breaking alerts — sent when major market events happen
- Weekly digest — top finance stories every Friday

To confirm your subscription, visit:
${confirmUrl}

This link expires in 24 hours.

If you did not request this subscription, ignore this email. No action is required.

—
FinCNews · finc.news
You are receiving this because you entered your email at finc.news`;

  return { html, text };
}

// ─── Welcome (after DOI confirmed) ──────────────────────────────────────────

export function welcomeEmail(token: string, baseUrl: string): EmailContent {
  const html = shell(`
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${WHITE};letter-spacing:-0.5px;">
      You're subscribed to FinCNews.
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:${TEXT};">
      Welcome. Your subscription is now active. You will receive breaking news alerts when significant market events occur, and a curated weekly digest of the top finance stories every Friday.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="padding:12px 0;border-top:1px solid ${BORDER};">
          <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:${CYAN};">Breaking alerts</p>
          <p style="margin:0;font-size:13px;color:${TEXT};line-height:1.6;">Real-time notifications for major moves in crypto, equities, and macro — sent as they happen, not batched.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-top:1px solid ${BORDER};">
          <p style="margin:0 0 3px;font-size:13px;font-weight:600;color:${CYAN};">Weekly digest</p>
          <p style="margin:0;font-size:13px;color:${TEXT};line-height:1.6;">Every Friday: the 5-10 most important finance stories of the week, summarized and ranked by significance.</p>
        </td>
      </tr>
    </table>

    ${divider()}

    <p style="margin:0;font-size:12px;color:${FOOTER};line-height:1.7;">
      You can ${unsubLink(token, baseUrl)} at any time using the link in any email we send. No questions asked.
    </p>
  `);

  const text = `FinCNews — You're subscribed

Welcome. Your subscription is now active.

What you will receive:

Breaking alerts — real-time notifications for major moves in crypto, equities, and macro. Sent as they happen, not batched.

Weekly digest — every Friday: the 5-10 most important finance stories of the week, summarized and ranked by significance.

To unsubscribe at any time: ${baseUrl}/api/unsubscribe?token=${token}

—
FinCNews · finc.news`;

  return { html, text };
}

// ─── Breaking alert ──────────────────────────────────────────────────────────

export function breakingEmail(opts: {
  headline: string;
  excerpt: string;
  articleUrl: string;
  token: string;
  baseUrl: string;
}): EmailContent {
  const { headline, excerpt, articleUrl, token, baseUrl } = opts;

  const html = shell(`
    <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:${CYAN};text-transform:uppercase;">
      Breaking News &mdash; FinCNews
    </p>
    <h1 style="margin:0 0 14px;font-size:20px;font-weight:700;color:${WHITE};letter-spacing:-0.4px;line-height:1.35;">
      ${headline}
    </h1>
    <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:${TEXT};">
      ${excerpt}
    </p>
    <p style="margin:0;font-size:13px;color:${TEXT};">
      Read the full analysis and market context at finc.news.
    </p>

    ${btn(articleUrl, "Read full story →")}

    ${divider()}

    <p style="margin:0;font-size:12px;color:${FOOTER};line-height:1.6;">
      You are receiving this breaking alert because you subscribed to FinCNews at finc.news.<br />
      ${unsubLink(token, baseUrl)}
    </p>
  `);

  const text = `FinCNews Breaking Alert

${headline}

${excerpt}

Read the full story: ${articleUrl}

—
FinCNews · finc.news
Unsubscribe: ${baseUrl}/api/unsubscribe?token=${token}`;

  return { html, text };
}

// ─── Weekly digest ───────────────────────────────────────────────────────────

export type DigestArticle = {
  headline: string;
  excerpt: string;
  url: string;
  category: string;
};

export function digestEmail(opts: {
  weekLabel: string;
  articles: DigestArticle[];
  token: string;
  baseUrl: string;
}): EmailContent {
  const { weekLabel, articles, token, baseUrl } = opts;

  const rows = articles
    .map(
      (a) => `
    <tr>
      <td style="padding:18px 0;border-top:1px solid ${BORDER};">
        <p style="margin:0 0 4px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${FOOTER};">${a.category}</p>
        <a href="${a.url}" style="text-decoration:none;">
          <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:${WHITE};line-height:1.35;">${a.headline}</p>
        </a>
        <p style="margin:0;font-size:13px;color:${TEXT};line-height:1.6;">${a.excerpt}</p>
      </td>
    </tr>`
    )
    .join("");

  const textArticles = articles
    .map((a, i) => `${i + 1}. [${a.category.toUpperCase()}] ${a.headline}\n${a.excerpt}\n${a.url}`)
    .join("\n\n");

  const html = shell(`
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:${CYAN};text-transform:uppercase;">
      Weekly Digest &mdash; FinCNews
    </p>
    <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:${WHITE};letter-spacing:-0.4px;">
      ${weekLabel}
    </h1>
    <p style="margin:0 0 24px;font-size:13px;color:${TEXT};">
      The most important finance stories of the week, curated and ranked by significance.
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${rows}
    </table>

    ${divider()}

    <p style="margin:0;font-size:12px;color:${FOOTER};line-height:1.6;">
      You are receiving this weekly digest because you subscribed to FinCNews at finc.news.<br />
      ${unsubLink(token, baseUrl)}
    </p>
  `);

  const text = `FinCNews Weekly Digest — ${weekLabel}

The most important finance stories of the week.

${textArticles}

—
FinCNews · finc.news
Unsubscribe: ${baseUrl}/api/unsubscribe?token=${token}`;

  return { html, text };
}
