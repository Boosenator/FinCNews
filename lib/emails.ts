const BASE = "#09090b";       // zinc-950
const CARD = "#18181b";       // zinc-900
const BORDER = "#27272a";     // zinc-800
const TEXT = "#a1a1aa";       // zinc-400
const MUTED = "#52525b";      // zinc-600
const WHITE = "#f4f4f5";      // zinc-100
const CYAN = "#22d3ee";       // cyan-400

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
            <p style="margin:0;font-size:12px;color:${MUTED};">
              FinCNews · Fast finance intelligence
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
  return `<a href="${baseUrl}/api/unsubscribe?token=${token}" style="color:${MUTED};font-size:12px;">Unsubscribe</a>`;
}

// ─── Confirmation (DOI) ──────────────────────────────────────────────────────

export function confirmationEmail(confirmUrl: string): string {
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${WHITE};letter-spacing:-0.5px;">
      Confirm your subscription
    </h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:${TEXT};">
      You're one click away from getting breaking finance news — crypto, markets, macro and fintech — delivered straight to your inbox.
    </p>

    ${btn(confirmUrl, "Confirm subscription →")}

    ${divider()}

    <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">
      If you didn't request this, ignore this email — nothing will happen.<br />
      The link expires in 24 hours.
    </p>
  `;
  return shell(body);
}

// ─── Welcome (after DOI confirmed) ──────────────────────────────────────────

export function welcomeEmail(token: string, baseUrl: string): string {
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${WHITE};letter-spacing:-0.5px;">
      You're in.
    </h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${TEXT};">
      Welcome to FinCNews. Here's what you'll get:
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;">
      <tr>
        <td style="padding:12px 0;border-top:1px solid ${BORDER};">
          <span style="font-size:13px;color:${CYAN};font-weight:600;">Breaking alerts</span>
          <span style="font-size:13px;color:${TEXT};"> · When major market moves happen</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-top:1px solid ${BORDER};">
          <span style="font-size:13px;color:${CYAN};font-weight:600;">Weekly digest</span>
          <span style="font-size:13px;color:${TEXT};"> · Top stories every Friday</span>
        </td>
      </tr>
    </table>

    ${divider()}

    <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.6;">
      ${unsubLink(token, baseUrl)} at any time — no hard feelings.
    </p>
  `;
  return shell(body);
}

// ─── Breaking alert ──────────────────────────────────────────────────────────

export function breakingEmail(opts: {
  headline: string;
  excerpt: string;
  articleUrl: string;
  token: string;
  baseUrl: string;
}): string {
  const { headline, excerpt, articleUrl, token, baseUrl } = opts;
  const body = `
    <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:${CYAN};text-transform:uppercase;">
      Breaking
    </p>
    <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:${WHITE};letter-spacing:-0.4px;line-height:1.3;">
      ${headline}
    </h1>
    <p style="margin:0;font-size:14px;line-height:1.65;color:${TEXT};">
      ${excerpt}
    </p>

    ${btn(articleUrl, "Read full story →")}

    ${divider()}

    <p style="margin:0;font-size:12px;color:${MUTED};">
      ${unsubLink(token, baseUrl)}
    </p>
  `;
  return shell(body);
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
}): string {
  const { weekLabel, articles, token, baseUrl } = opts;

  const rows = articles
    .map(
      (a) => `
    <tr>
      <td style="padding:18px 0;border-top:1px solid ${BORDER};">
        <p style="margin:0 0 3px;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">${a.category}</p>
        <a href="${a.url}" style="text-decoration:none;">
          <p style="margin:0 0 5px;font-size:15px;font-weight:600;color:${WHITE};line-height:1.35;">${a.headline}</p>
        </a>
        <p style="margin:0;font-size:13px;color:${TEXT};line-height:1.55;">${a.excerpt}</p>
      </td>
    </tr>
  `
    )
    .join("");

  const body = `
    <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.1em;color:${CYAN};text-transform:uppercase;">
      Weekly digest
    </p>
    <h1 style="margin:0 0 24px;font-size:20px;font-weight:700;color:${WHITE};letter-spacing:-0.4px;">
      ${weekLabel}
    </h1>

    <table cellpadding="0" cellspacing="0" style="width:100%;">
      ${rows}
    </table>

    ${divider()}

    <p style="margin:0;font-size:12px;color:${MUTED};">
      ${unsubLink(token, baseUrl)}
    </p>
  `;
  return shell(body);
}
