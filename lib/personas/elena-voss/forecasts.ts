import { supabaseAdmin } from '@/lib/supabase';
import { callClaude, parseClaudeJson } from '@/lib/personas/shared';

const PERSONA_ID = 'elena-voss';

export interface ForecastRecord {
  metric:          string;   // 'btc_price' | 'fed_funds_rate' | '10y_yield' | 'dxy'
  direction:       'up' | 'down' | 'hold';
  magnitude:       string;   // ">5%" | "cut 25bps" | "above 4.5%"
  timeframe_hours: number;
  statement:       string;   // Elena's exact statement that implies the forecast
  status:          'open' | 'correct' | 'incorrect' | 'expired';
  article_slug:    string;
  resolved_at:     string | null;
  result_note:     string | null;
  created_at:      string;
}

// Called after article publication — extracts implicit forecast if any
export async function extractAndSaveForecast(
  title: string,
  body: string,
  articleSlug: string
): Promise<void> {
  const prompt = `You are analyzing Elena Voss's article to extract any implicit or explicit macro forecast.

ARTICLE TITLE: ${title}
ARTICLE BODY (preview): ${body.slice(0, 1200)}

Does this article contain a directional forecast for any of these metrics?
- btc_price (BTC USD price direction)
- fed_funds_rate (Fed rate change expectation)
- 10y_yield (10-year Treasury direction)
- dxy (dollar strength direction)

Rules:
- Only extract if there's a SPECIFIC directional claim, not just "watch X"
- "Everything reprices" or "markets will react" is NOT a forecast — skip
- A real forecast: "BTC is priced for the wrong scenario and will reprice lower"
- timeframe_hours: 72 for short-term, 168 (1 week) for weekly, 720 (30 days) for monthly

Return ONLY valid JSON:
{
  "has_forecast": boolean,
  "metric": "btc_price" | "fed_funds_rate" | "10y_yield" | "dxy" | null,
  "direction": "up" | "down" | "hold" | null,
  "magnitude": "brief qualifier like '>5%' or 'cut 25bps' or 'hold'" | null,
  "timeframe_hours": 72 | 168 | 720 | null,
  "statement": "Elena's exact sentence implying the forecast, or null"
}`;

  let parsed: {
    has_forecast: boolean;
    metric: string | null;
    direction: string | null;
    magnitude: string | null;
    timeframe_hours: number | null;
    statement: string | null;
  };

  try {
    const res = await callClaude({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    parsed = await parseClaudeJson(res);
  } catch {
    return; // forecast extraction is best-effort
  }

  if (!parsed.has_forecast || !parsed.metric || !parsed.direction) return;

  const db = supabaseAdmin();
  await db.from('persona_memory').insert({
    persona_id:  PERSONA_ID,
    memory_type: 'forecast',
    content:     `Forecast: ${parsed.metric} ${parsed.direction} ${parsed.magnitude ?? ''} within ${parsed.timeframe_hours}h. "${parsed.statement}"`,
    metadata: {
      metric:          parsed.metric as string,
      direction:       (parsed.direction ?? 'hold') as 'up' | 'down' | 'hold',
      magnitude:       parsed.magnitude ?? '',
      timeframe_hours: parsed.timeframe_hours ?? 72,
      statement:       parsed.statement ?? '',
      status:          'open',
      article_slug:    articleSlug,
      resolved_at:     null,
      result_note:     null,
      created_at:      new Date().toISOString(),
    } satisfies Omit<ForecastRecord, 'status'> & { status: 'open' },
  });
}

// Verifies open forecasts — called by midnight cron or manual trigger
export async function verifyOpenForecasts(): Promise<{ verified: number; correct: number }> {
  const db = supabaseAdmin();

  const { data: openForecasts } = await db
    .from('persona_memory')
    .select('id, metadata, created_at')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'forecast')
    .filter('metadata->>status', 'eq', 'open');

  if (!openForecasts?.length) return { verified: 0, correct: 0 };

  // Fetch current BTC price once for all BTC forecasts
  let currentBtcPrice: number | null = null;
  const hasBtcForecast = openForecasts.some(f => (f.metadata as Record<string, unknown>).metric === 'btc_price');
  if (hasBtcForecast) {
    currentBtcPrice = await fetchCurrentBtcPrice();
  }

  let verified = 0;
  let correct  = 0;

  for (const forecast of openForecasts) {
    const meta     = forecast.metadata as unknown as ForecastRecord;
    const ageHours = (Date.now() - new Date(meta.created_at).getTime()) / 3_600_000;

    if (ageHours < meta.timeframe_hours) continue; // not yet due

    const result = await evaluateForecast(meta, currentBtcPrice);
    if (!result) continue;

    await db
      .from('persona_memory')
      .update({
        metadata: {
          ...meta,
          status:      result.correct ? 'correct' : 'incorrect',
          resolved_at: new Date().toISOString(),
          result_note: result.note,
        },
        content: `Forecast [${result.correct ? 'CORRECT' : 'INCORRECT'}]: ${meta.metric} ${meta.direction} ${meta.magnitude ?? ''}. ${result.note}`,
      })
      .eq('id', forecast.id);

    verified++;
    if (result.correct) correct++;
  }

  return { verified, correct };
}

// Returns open forecasts as context text
export async function getOpenForecastsContext(): Promise<string> {
  const db = supabaseAdmin();

  const [open, resolved] = await Promise.all([
    db
      .from('persona_memory')
      .select('content, metadata, created_at')
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'forecast')
      .filter('metadata->>status', 'eq', 'open')
      .order('created_at', { ascending: false })
      .limit(3),
    db
      .from('persona_memory')
      .select('content, metadata')
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'forecast')
      .in('metadata->>status' as 'metadata', ['correct', 'incorrect'])
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const parts: string[] = [];

  if (open.data?.length) {
    parts.push('Active forecasts (open):');
    open.data.forEach(f => {
      const m = f.metadata as unknown as ForecastRecord;
      const ageH = Math.round((Date.now() - new Date(m.created_at).getTime()) / 3_600_000);
      parts.push(`  - ${m.metric} ${m.direction} ${m.magnitude ?? ''} [${ageH}h/${m.timeframe_hours}h elapsed]`);
    });
  }

  if (resolved.data?.length) {
    const total   = resolved.data.length;
    const correct = resolved.data.filter(f => (f.metadata as Record<string, unknown>).status === 'correct').length;
    parts.push(`Forecast track record: ${correct}/${total} correct`);
  }

  return parts.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchCurrentBtcPrice(): Promise<number | null> {
  try {
    const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await res.json() as { bitcoin: { usd: number } };
    return data.bitcoin?.usd ?? null;
  } catch {
    return null;
  }
}

async function evaluateForecast(
  meta: ForecastRecord,
  currentBtcPrice: number | null
): Promise<{ correct: boolean; note: string } | null> {
  if (meta.metric === 'btc_price' && currentBtcPrice !== null) {
    // We need the price at forecast creation — stored as article data_snapshot would be ideal
    // For now, use a simple heuristic: if direction=down and BTC is significantly lower, correct
    // Full implementation would store the price at forecast creation time
    const note = `BTC at $${currentBtcPrice.toLocaleString()} at verification time`;
    // Mark as expired if we can't properly verify — this is Phase 1
    return { correct: false, note: `${note} — manual verification needed` };
  }

  // For non-BTC forecasts, mark as expired for now
  return { correct: false, note: 'Expired — manual verification needed' };
}
