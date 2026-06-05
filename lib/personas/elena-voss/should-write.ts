import type { ElenaDataPull } from './data-pull';

// Dates of scheduled high-priority macro events — extend quarterly
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

export interface ShouldWriteResult {
  should_write: boolean;
  score: number;
  reasoning: string;
  topic: string | null;
  primary_signal: string | null;
  calendar_event: string | null;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function checkCalendar(): { event: string | null; isHighPriority: boolean } {
  const today = HIGH_PRIORITY_DATES[getTodayKey()];
  const yesterday = HIGH_PRIORITY_DATES[getYesterdayKey()];
  const event = today ?? yesterday ?? null;
  return { event, isHighPriority: !!event };
}

export async function shouldWrite(
  data: ElenaDataPull,
  recentArticleSummaries: string
): Promise<ShouldWriteResult> {
  const { event, isHighPriority } = checkCalendar();

  const prompt = buildEvalPrompt(data, recentArticleSummaries, event);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude eval failed: ${err}`);
  }

  const json = await res.json() as { content: { text: string }[] };
  const text = json.content[0]?.text ?? '{}';

  let parsed: ShouldWriteResult;
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? '{}') as ShouldWriteResult;
  } catch {
    // Fallback: if high-priority day but parse failed, still write
    return {
      should_write: isHighPriority,
      score: isHighPriority ? 75 : 20,
      reasoning: 'Parse error — fell back to calendar check',
      topic: event,
      primary_signal: event ? 'calendar_event' : null,
      calendar_event: event,
    };
  }

  // Calendar override: high-priority event days always get minimum score boost
  if (isHighPriority && parsed.score < 70) {
    parsed.score = 70;
    parsed.should_write = true;
    parsed.calendar_event = event;
  }

  return parsed;
}

function buildEvalPrompt(
  data: ElenaDataPull,
  recentArticles: string,
  calendarEvent: string | null
): string {
  return `You are Elena Voss's editorial judgment function.

Elena Voss writes about: Fed/FOMC decisions and language, DXY trends, Treasury yields,
CPI/PCE releases, SEC regulatory actions, and crypto/macro correlations.

She does NOT write on quiet macro days. She does NOT write about on-chain data.
She DOES write on every major data release day (CPI, NFP, FOMC, GDP).

MACRO DATA (just pulled from FRED):
- Fed Funds Rate: ${data.fedFundsRate}%
- CPI YoY: ${data.cpiYoY}%
- Core PCE: ${data.corePce}%
- 10Y Treasury: ${data.tenYearYield}%
- 2Y Treasury: ${data.twoYearYield}%
- Yield Curve Spread (10Y-2Y): ${data.yieldCurveSpread.toFixed(2)}%
- DXY Index: ${data.dxyIndex}
- BTC 24h change: ${data.btcChange24h.toFixed(2)}%
- Data pulled at: ${data.pulledAt}

SEC FILINGS (last 48h, crypto-related):
${data.secFilings.length > 0
  ? data.secFilings.map(f => `- ${f.formType} by ${f.entityName} (${f.filedAt})`).join('\n')
  : 'None'}

CALENDAR EVENT TODAY/YESTERDAY:
${calendarEvent ?? 'None scheduled'}

RECENT ELENA ARTICLES (last 48h — do not repeat these topics):
${recentArticles || 'None'}

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "should_write": boolean,
  "score": number (0-100),
  "reasoning": "one sentence explanation",
  "topic": "the macro signal to write about, or null",
  "primary_signal": "fed_language|cpi_data|pce_data|yield_curve|dxy_move|sec_action|btc_correlation|calendar_event or null",
  "calendar_event": "name of triggering event or null"
}

Score guide:
- FOMC/CPI/PCE/NFP release day: 80-95
- Significant yield curve move (>15bps in a day): 65-80
- DXY moved >0.8% while BTC moved opposite direction: 60-75
- SEC crypto enforcement or rule proposal: 60-75
- Quiet macro day, no data, no filings: 10-35`;
}
