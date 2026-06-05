import { supabaseAdmin } from '@/lib/supabase';
import { callClaude, parseClaudeJson } from '@/lib/personas/shared';
import type { MarcusDataPull } from './data-pull';

const PERSONA_ID = 'marcus-webb';

export interface ForecastRecord {
  metric:          string;
  direction:       'up' | 'down' | 'hold';
  magnitude:       string;
  timeframe_hours: number;
  statement:       string;
  status:          'open' | 'correct' | 'incorrect' | 'expired';
  article_slug:    string;
  trigger_value:   number | null;  // current metric value at forecast creation time
  resolved_at:     string | null;
  result_note:     string | null;
  created_at:      string;
}

// ── Live data fetchers for verification ──────────────────────────────────────

async function fetchCurrentBtcPrice(): Promise<number | null> {
  try {
    const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await res.json() as { bitcoin: { usd: number } };
    return data.bitcoin?.usd ?? null;
  } catch { return null; }
}

async function fetchCurrentHashrate(): Promise<number | null> {
  try {
    const res  = await fetch('https://mempool.space/api/v1/mining/hashrate/1m');
    const data = await res.json() as { hashrates?: { avgHashrate: number }[] };
    const rates = data.hashrates ?? [];
    return rates.length > 0 ? rates[rates.length - 1].avgHashrate : null;
  } catch { return null; }
}

async function fetchCurrentMempoolTxCount(): Promise<number | null> {
  try {
    const res  = await fetch('https://mempool.space/api/mempool');
    const data = await res.json() as { count: number };
    return data.count ?? null;
  } catch { return null; }
}

async function fetchCurrentExchangeNetflow(): Promise<number | null> {
  const key = process.env.COINGLASS_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      'https://open-api.coinglass.com/public/v2/indicator/bitcoin_exchanges_net_flow',
      { headers: { 'CG-API-KEY': key } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { data?: { netflow?: number }[] };
    return data.data?.[0]?.netflow ?? null;
  } catch { return null; }
}

function getTriggerValue(metric: string, data: MarcusDataPull): number | null {
  switch (metric) {
    case 'btc_price':         return data.btcPrice;
    case 'exchange_netflow':  return data.btcExchangeNetflow;
    case 'hashrate':          return data.btcHashrate;
    case 'mempool':           return data.mempoolTxCount;
    default:                  return null;
  }
}

// ── Extract + Save ────────────────────────────────────────────────────────────

export async function extractAndSaveForecast(
  title:       string,
  body:        string,
  articleSlug: string,
  data:        MarcusDataPull
): Promise<void> {
  const prompt = `Extract Marcus Webb's "What to watch" forecast from this article.

ARTICLE: ${title}
BODY (last section): ${body.slice(-600)}

Marcus always ends with "What to watch: if [metric] [crosses] [threshold], [implication]"
Extract the directional forecast implied.

Return ONLY valid JSON:
{
  "has_forecast": boolean,
  "metric": "btc_price" | "exchange_netflow" | "hashrate" | "mempool" | null,
  "direction": "up" | "down" | "hold" | null,
  "magnitude": "threshold or condition like '>5%' or 'turns negative'" | null,
  "timeframe_hours": 72 | 168 | null,
  "statement": "exact What to watch sentence" | null
}`;

  let parsed: { has_forecast: boolean; metric: string | null; direction: string | null; magnitude: string | null; timeframe_hours: number | null; statement: string | null };
  try {
    const res = await callClaude({ model: 'claude-haiku-4-5-20251001', max_tokens: 256, messages: [{ role: 'user', content: prompt }] });
    parsed = await parseClaudeJson(res);
  } catch { return; }

  if (!parsed.has_forecast || !parsed.metric || !parsed.direction) return;

  const triggerValue = getTriggerValue(parsed.metric, data);

  const db = supabaseAdmin();
  await db.from('persona_memory').insert({
    persona_id:  PERSONA_ID,
    memory_type: 'forecast',
    content:     `Forecast: ${parsed.metric} ${parsed.direction} (${parsed.magnitude ?? ''}) within ${parsed.timeframe_hours}h. "${parsed.statement}"`,
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

export async function verifyOpenForecasts(currentBtcPrice: number): Promise<{ verified: number; correct: number }> {
  const db = supabaseAdmin();
  const { data: open } = await db
    .from('persona_memory')
    .select('id, metadata, created_at')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'forecast')
    .filter('metadata->>status', 'eq', 'open');

  if (!open?.length) return { verified: 0, correct: 0 };

  // Fetch current on-chain values once
  const [hashrate, mempoolTx, exchangeNetflow] = await Promise.all([
    fetchCurrentHashrate(),
    fetchCurrentMempoolTxCount(),
    fetchCurrentExchangeNetflow(),
  ]);

  const currentValues: Record<string, number | null> = {
    btc_price:        currentBtcPrice,
    hashrate:         hashrate,
    mempool:          mempoolTx,
    exchange_netflow: exchangeNetflow,
  };

  let verified = 0, correct = 0;

  for (const row of open) {
    const meta = row.metadata as unknown as ForecastRecord;
    const ageH = (Date.now() - new Date(meta.created_at).getTime()) / 3_600_000;
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
      if (meta.direction === 'down')    { correct = pctDiff < -0.03; }
      else if (meta.direction === 'up') { correct = pctDiff > 0.03; }
      else { correct = Math.abs(pctDiff) < 0.03; }
      note = `BTC ${pctDiff > 0 ? '+' : ''}${(pctDiff * 100).toFixed(1)}% from $${meta.trigger_value.toLocaleString()} → $${currentValue.toLocaleString()}`;
      break;

    case 'hashrate':
      // Hashrate: % change, threshold 3%
      if (meta.direction === 'down')    { correct = pctDiff < -0.03; }
      else if (meta.direction === 'up') { correct = pctDiff > 0.03; }
      else { correct = Math.abs(pctDiff) < 0.03; }
      note = `Hashrate ${pctDiff > 0 ? '+' : ''}${(pctDiff * 100).toFixed(1)}% from ${(meta.trigger_value / 1e6).toFixed(2)} → ${(currentValue / 1e6).toFixed(2)} EH/s`;
      break;

    case 'mempool':
      // Mempool tx count: % change, threshold 20%
      if (meta.direction === 'down')    { correct = pctDiff < -0.20; }
      else if (meta.direction === 'up') { correct = pctDiff > 0.20; }
      else { correct = Math.abs(pctDiff) < 0.10; }
      note = `Mempool ${pctDiff > 0 ? '+' : ''}${(pctDiff * 100).toFixed(0)}% from ${meta.trigger_value.toLocaleString()} → ${currentValue.toLocaleString()} txs`;
      break;

    case 'exchange_netflow':
      // Netflow: directional sign change, threshold 5000 BTC
      if (meta.direction === 'down')    { correct = currentValue < -5000; }
      else if (meta.direction === 'up') { correct = currentValue > 5000; }
      else { correct = Math.abs(currentValue) < 5000; }
      note = `Exchange netflow: ${currentValue.toFixed(0)} BTC (was ${meta.trigger_value.toFixed(0)})`;
      break;

    default:
      return null;
  }

  return { correct, note };
}

// ── Context ───────────────────────────────────────────────────────────────────

export async function getForecastContext(): Promise<string> {
  const db = supabaseAdmin();
  const [{ data: openF }, { data: resolved }] = await Promise.all([
    db.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'forecast').filter('metadata->>status', 'eq', 'open').order('created_at', { ascending: false }).limit(3),
    db.from('persona_memory').select('metadata').eq('persona_id', PERSONA_ID).eq('memory_type', 'forecast').in('metadata->>status' as 'metadata', ['correct', 'incorrect']).order('created_at', { ascending: false }).limit(10),
  ]);

  const parts: string[] = [];
  if (openF?.length) {
    parts.push('Open forecasts:');
    openF.forEach(f => {
      const m = f.metadata as unknown as ForecastRecord;
      const h = Math.round((Date.now() - new Date(m.created_at).getTime()) / 3_600_000);
      const baseline = m.trigger_value !== null ? ` (baseline: ${m.trigger_value.toFixed(2)})` : '';
      parts.push(`  - ${m.metric} ${m.direction} ${m.magnitude}${baseline} [${h}h/${m.timeframe_hours}h elapsed]`);
    });
  }
  if (resolved?.length) {
    const total = resolved.length;
    const c     = resolved.filter(f => (f.metadata as Record<string, unknown>).status === 'correct').length;
    parts.push(`Forecast accuracy: ${c}/${total} correct`);
  }
  return parts.join('\n');
}
