import { supabaseAdmin } from '@/lib/supabase';
import { callClaude, parseClaudeJson } from '@/lib/personas/shared';
import type { ElenaDataPull } from './data-pull';

const PERSONA_ID = 'elena-voss';

export interface ForecastRecord {
  metric:          string;
  direction:       'up' | 'down' | 'hold';
  magnitude:       string;
  timeframe_hours: number;
  statement:       string;
  status:          'open' | 'correct' | 'incorrect' | 'expired';
  article_slug:    string;
  trigger_value:   number | null;  // value of metric at forecast creation time
  resolved_at:     string | null;
  result_note:     string | null;
  created_at:      string;
}

// ── FRED lookup helpers ───────────────────────────────────────────────────────

const METRIC_TO_FRED: Record<string, string> = {
  fed_funds_rate: 'FEDFUNDS',
  '10y_yield':    'DGS10',
  '2y_yield':     'DGS2',
  dxy:            'DTWEXBGS',
};

async function fetchFredCurrent(seriesId: string): Promise<number | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=1&observation_start=2020-01-01`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as { observations: { value: string }[] };
    const v    = data.observations?.[0]?.value;
    return v && v !== '.' ? parseFloat(v) : null;
  } catch { return null; }
}

async function fetchCurrentBtcPrice(): Promise<number | null> {
  try {
    const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await res.json() as { bitcoin: { usd: number } };
    return data.bitcoin?.usd ?? null;
  } catch { return null; }
}

function getTriggerValue(metric: string, data: ElenaDataPull): number | null {
  switch (metric) {
    case 'fed_funds_rate': return data.fedFundsRate;
    case '10y_yield':      return data.tenYearYield;
    case '2y_yield':       return data.twoYearYield;
    case 'dxy':            return data.dxyIndex;
    case 'btc_price':      return null; // Elena's data pull doesn't have abs BTC price
    default:               return null;
  }
}

// ── Extract + Save ────────────────────────────────────────────────────────────

export async function extractAndSaveForecast(
  title:       string,
  body:        string,
  articleSlug: string,
  data:        ElenaDataPull
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

  let parsed: { has_forecast: boolean; metric: string | null; direction: string | null; magnitude: string | null; timeframe_hours: number | null; statement: string | null };
  try {
    const res = await callClaude({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, messages: [{ role: 'user', content: prompt }] });
    parsed = await parseClaudeJson(res);
  } catch { return; }

  if (!parsed.has_forecast || !parsed.metric || !parsed.direction) return;

  const triggerValue = getTriggerValue(parsed.metric, data);

  const db = supabaseAdmin();
  await db.from('persona_memory').insert({
    persona_id:  PERSONA_ID,
    memory_type: 'forecast',
    content:     `Forecast: ${parsed.metric} ${parsed.direction} ${parsed.magnitude ?? ''} within ${parsed.timeframe_hours}h. "${parsed.statement}"`,
    metadata: {
      metric:          parsed.metric,
      direction:       (parsed.direction ?? 'hold') as 'up' | 'down' | 'hold',
      magnitude:       parsed.magnitude ?? '',
      timeframe_hours: parsed.timeframe_hours ?? 72,
      statement:       parsed.statement ?? '',
      status:          'open',
      article_slug:    articleSlug,
      trigger_value:   triggerValue,
      resolved_at:     null,
      result_note:     null,
      created_at:      new Date().toISOString(),
    },
  });
}

// ── Verify ────────────────────────────────────────────────────────────────────

export async function verifyOpenForecasts(): Promise<{ verified: number; correct: number }> {
  const db = supabaseAdmin();
  const { data: open } = await db
    .from('persona_memory')
    .select('id, metadata, created_at')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'forecast')
    .filter('metadata->>status', 'eq', 'open');

  if (!open?.length) return { verified: 0, correct: 0 };

  // Fetch current values once, reuse for all forecasts
  const [btcPrice, ...fredValues] = await Promise.all([
    fetchCurrentBtcPrice(),
    ...Object.entries(METRIC_TO_FRED).map(([, series]) => fetchFredCurrent(series)),
  ]);

  const currentValues: Record<string, number | null> = { btc_price: btcPrice };
  Object.keys(METRIC_TO_FRED).forEach((metric, i) => {
    currentValues[metric] = fredValues[i] ?? null;
  });

  let verified = 0, correct = 0;

  for (const row of open) {
    const meta    = row.metadata as unknown as ForecastRecord;
    const ageH    = (Date.now() - new Date(meta.created_at).getTime()) / 3_600_000;
    if (ageH < meta.timeframe_hours) continue;

    const current = currentValues[meta.metric];
    const result  = evaluateForecast(meta, current);
    if (!result) continue;

    await db.from('persona_memory').update({
      content:  `Forecast [${result.correct ? 'CORRECT' : 'INCORRECT'}]: ${meta.metric} ${meta.direction}. ${result.note}`,
      metadata: { ...meta, status: result.correct ? 'correct' : 'incorrect', resolved_at: new Date().toISOString(), result_note: result.note },
    }).eq('id', row.id);

    verified++;
    if (result.correct) correct++;
  }

  return { verified, correct };
}

function evaluateForecast(meta: ForecastRecord, currentValue: number | null): { correct: boolean; note: string } | null {
  if (currentValue === null || meta.trigger_value === null) {
    return { correct: false, note: `No baseline stored — cannot verify automatically` };
  }

  const diff    = currentValue - meta.trigger_value;
  const pctDiff = diff / meta.trigger_value;
  let correct   = false;
  let note      = '';

  switch (meta.metric) {
    case 'btc_price':
      // BTC: percentage change, threshold 3%
      if (meta.direction === 'down')  { correct = pctDiff < -0.03; }
      else if (meta.direction === 'up') { correct = pctDiff > 0.03; }
      else { correct = Math.abs(pctDiff) < 0.03; }
      note = `BTC ${pctDiff > 0 ? '+' : ''}${(pctDiff * 100).toFixed(1)}% from $${meta.trigger_value.toLocaleString()} to $${currentValue.toLocaleString()}`;
      break;

    case 'fed_funds_rate':
    case '10y_yield':
    case '2y_yield':
      // Rate metrics: basis points, threshold 15bps
      if (meta.direction === 'down')  { correct = diff < -0.15; }
      else if (meta.direction === 'up') { correct = diff > 0.15; }
      else { correct = Math.abs(diff) < 0.15; }
      note = `${meta.metric} moved ${diff > 0 ? '+' : ''}${(diff * 100).toFixed(0)}bps from ${meta.trigger_value.toFixed(2)}% to ${currentValue.toFixed(2)}%`;
      break;

    case 'dxy':
      // Dollar index: percentage change, threshold 1%
      if (meta.direction === 'down')  { correct = pctDiff < -0.01; }
      else if (meta.direction === 'up') { correct = pctDiff > 0.01; }
      else { correct = Math.abs(pctDiff) < 0.01; }
      note = `USD index ${pctDiff > 0 ? '+' : ''}${(pctDiff * 100).toFixed(1)}% from ${meta.trigger_value.toFixed(2)} to ${currentValue.toFixed(2)}`;
      break;

    default:
      return null;
  }

  return { correct, note };
}

// ── Context ───────────────────────────────────────────────────────────────────

export async function getOpenForecastsContext(): Promise<string> {
  const db = supabaseAdmin();
  const [{ data: openF }, { data: resolved }] = await Promise.all([
    db.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'forecast').filter('metadata->>status', 'eq', 'open').order('created_at', { ascending: false }).limit(3),
    db.from('persona_memory').select('metadata').eq('persona_id', PERSONA_ID).eq('memory_type', 'forecast').in('metadata->>status' as 'metadata', ['correct', 'incorrect']).order('created_at', { ascending: false }).limit(10),
  ]);

  const parts: string[] = [];
  if (openF?.length) {
    parts.push('Active forecasts (open):');
    openF.forEach(f => {
      const m = f.metadata as unknown as ForecastRecord;
      const ageH = Math.round((Date.now() - new Date(m.created_at).getTime()) / 3_600_000);
      const baseline = m.trigger_value !== null ? ` (baseline: ${m.trigger_value})` : '';
      parts.push(`  - ${m.metric} ${m.direction} ${m.magnitude}${baseline} [${ageH}h/${m.timeframe_hours}h]`);
    });
  }
  if (resolved?.length) {
    const total = resolved.length;
    const c     = resolved.filter(f => (f.metadata as Record<string, unknown>).status === 'correct').length;
    parts.push(`Forecast accuracy: ${c}/${total} correct`);
  }
  return parts.join('\n');
}
