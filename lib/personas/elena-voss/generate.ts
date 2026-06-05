import type { ElenaDataPull } from './data-pull';
import type { ShouldWriteResult } from './should-write';

export interface GeneratedArticle {
  title: string;
  excerpt: string;
  body: string;           // markdown — normalizeBody in publish route handles conversion
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  category: string;
  telegramText: string;
}

const SYSTEM_PROMPT = `You are Elena Voss, macro analyst at finc.news.

BACKGROUND:
12 years in traditional finance: fixed income at Deutsche Bank, macro at a European family office.
Came to crypto in 2021 through a client allocation. You remain skeptical — not of crypto's
existence, but of the timeline. The macro context is not separate from the crypto trade — it IS the trade.

CORE BELIEF:
BTC is a risk asset. Until the Fed pivots and stays pivoted, crypto operates in the same
liquidity environment as every other risk asset.

WRITING RULES:
1. Open with the macro event or data point — precise number or exact Fed quote
2. Paragraph 2: where this sits in the current cycle (rate cycle, credit cycle, DXY trend)
3. Paragraph 3: historical BTC/crypto behavior in this macro configuration
4. Paragraph 4: what it means for crypto positioning — no speculation, data-backed only
5. Close with specific upcoming dates from economic calendar
6. Maximum 500 words
7. Always quote Fed language exactly — never paraphrase without the quote
8. Use: "However", "Notably", "This matters because", "Historically"
9. Never use: "moon", "rekt", "ape in", "community believes", "crypto is different this time"
10. When uncertain: say "the data doesn't resolve this yet" — never fake confidence

STRUCTURE:
[Macro event/data]: [precise value or quote].
[Cycle context — where we are historically].
[BTC correlation or precedent — specific data].
[Implication for crypto — one direction, hedged with conditions].
What's next: [date] — [event] — [what to watch specifically].

Use ## for section headers. Keep paragraphs tight — 3-5 sentences each.`;

export async function generateElenaArticle(
  data: ElenaDataPull,
  evalResult: ShouldWriteResult,
  recentContext: string
): Promise<GeneratedArticle> {
  const userPrompt = buildUserPrompt(data, evalResult, recentContext);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude generate failed: ${err}`);
  }

  const json = await res.json() as { content: { text: string }[] };
  const text = json.content[0]?.text ?? '';

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Elena generate: no JSON in response');

  return JSON.parse(match[0]) as GeneratedArticle;
}

function buildUserPrompt(
  data: ElenaDataPull,
  evalResult: ShouldWriteResult,
  recentContext: string
): string {
  const nextEvents = getUpcomingEvents();

  return `TODAY'S MACRO DATA (from FRED):
- Fed Funds Rate: ${data.fedFundsRate}%
- CPI YoY: ${data.cpiYoY}%
- Core PCE: ${data.corePce}%
- 10Y Treasury Yield: ${data.tenYearYield}%
- 2Y Treasury Yield: ${data.twoYearYield}%
- Yield Curve Spread (10Y-2Y): ${data.yieldCurveSpread.toFixed(2)}% ${data.yieldCurveSpread < 0 ? '(INVERTED)' : ''}
- USD Broad Index (DTWEXBGS): ${data.dxyIndex}
- BTC 24h change: ${data.btcChange24h.toFixed(2)}%

TODAY'S TRIGGER:
- Event: ${evalResult.calendar_event ?? evalResult.topic ?? 'Macro signal'}
- Signal type: ${evalResult.primary_signal}
- Editorial score: ${evalResult.score}/100
- Reasoning: ${evalResult.reasoning}

SEC FILINGS (last 48h):
${data.secFilings.length > 0
  ? data.secFilings.map(f => `- ${f.formType}: ${f.entityName} (${f.filedAt})`).join('\n')
  : 'None relevant'}

UPCOMING ECONOMIC CALENDAR:
${nextEvents}

YOUR RECENT ARTICLES (do not repeat topics):
${recentContext || 'None yet'}

Write the article and respond with ONLY valid JSON, no markdown wrapper:
{
  "title": "article title (max 80 chars, specific, data-driven)",
  "excerpt": "2-3 sentence summary for homepage card (max 200 chars)",
  "body": "full article in markdown, 400-500 words, use ## for headers",
  "metaTitle": "SEO title (max 60 chars)",
  "metaDescription": "SEO description (max 155 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "category": "one of: crypto|markets|economy|fintech|policy|companies",
  "telegramText": "5-7 lines for Telegram: lead with numbers, end with link placeholder {URL}"
}`;
}

function getUpcomingEvents(): string {
  // Same map as in should-write.ts — next 14 days
  const HIGH_PRIORITY_DATES: Record<string, string> = {
    '2025-06-11': 'CPI Release',
    '2025-06-12': 'FOMC Rate Decision',
    '2025-06-18': 'FOMC Minutes',
    '2025-06-27': 'PCE Release',
    '2025-07-09': 'CPI Release',
    '2025-07-16': 'FOMC Minutes',
    '2025-07-30': 'FOMC Rate Decision',
    '2025-08-01': 'NFP Release',
    '2025-08-13': 'CPI Release',
    '2025-08-22': 'PCE Release',
    '2025-09-05': 'NFP Release',
    '2025-09-10': 'CPI Release',
    '2025-09-17': 'FOMC Rate Decision',
    '2025-09-26': 'PCE Release',
  };

  const now = new Date();
  const cutoff = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return Object.entries(HIGH_PRIORITY_DATES)
    .filter(([date]) => {
      const d = new Date(date);
      return d >= now && d <= cutoff;
    })
    .map(([date, event]) => `- ${date}: ${event}`)
    .join('\n') || 'No major events in next 14 days';
}
