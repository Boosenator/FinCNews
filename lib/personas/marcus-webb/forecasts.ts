import { supabaseAdmin } from '@/lib/supabase';
import { callClaude, parseClaudeJson } from '@/lib/personas/shared';

const PERSONA_ID = 'marcus-webb';

export interface ForecastRecord {
  metric:          string;
  direction:       'up' | 'down' | 'hold';
  magnitude:       string;
  timeframe_hours: number;
  statement:       string;
  status:          'open' | 'correct' | 'incorrect' | 'expired';
  article_slug:    string;
  resolved_at:     string | null;
  result_note:     string | null;
  created_at:      string;
  trigger_price:   number | null; // BTC price at forecast creation
}

// Extract "What to watch" → forecast record
export async function extractAndSaveForecast(
  title:       string,
  body:        string,
  articleSlug: string,
  btcPrice:    number
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
      model: 'claude-haiku-4-5-20251001', max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });
    parsed = await parseClaudeJson(res);
  } catch {
    return;
  }

  if (!parsed.has_forecast || !parsed.metric || !parsed.direction) return;

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
      trigger_price:   btcPrice,
      resolved_at:     null,
      result_note:     null,
      created_at:      new Date().toISOString(),
    } satisfies Omit<ForecastRecord, 'status'> & { status: 'open' },
  });
}

// Verify open forecasts against current BTC price
export async function verifyOpenForecasts(currentBtcPrice: number): Promise<{ verified: number; correct: number }> {
  const db = supabaseAdmin();
  const { data: open } = await db
    .from('persona_memory')
    .select('id, metadata, created_at')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'forecast')
    .filter('metadata->>status', 'eq', 'open');

  if (!open?.length) return { verified: 0, correct: 0 };

  let verified = 0, correct = 0;

  for (const row of open) {
    const meta    = row.metadata as unknown as ForecastRecord;
    const ageH    = (Date.now() - new Date(meta.created_at).getTime()) / 3_600_000;
    if (ageH < meta.timeframe_hours) continue;

    let isCorrect = false;
    let note = `BTC $${currentBtcPrice.toLocaleString()} at verification`;

    if (meta.metric === 'btc_price' && meta.trigger_price) {
      const pctChange = ((currentBtcPrice - meta.trigger_price) / meta.trigger_price) * 100;
      isCorrect = meta.direction === 'down' ? pctChange < -3 : meta.direction === 'up' ? pctChange > 3 : Math.abs(pctChange) < 2;
      note = `BTC moved ${pctChange.toFixed(1)}% from trigger $${meta.trigger_price.toLocaleString()}`;
    }

    await db.from('persona_memory').update({
      content: `Forecast [${isCorrect ? 'CORRECT' : 'INCORRECT'}]: ${meta.metric} ${meta.direction}. ${note}`,
      metadata: { ...meta, status: isCorrect ? 'correct' : 'incorrect', resolved_at: new Date().toISOString(), result_note: note },
    }).eq('id', row.id);

    verified++;
    if (isCorrect) correct++;
  }

  return { verified, correct };
}

// Returns forecast context string for LLM
export async function getForecastContext(): Promise<string> {
  const db = supabaseAdmin();
  const [{ data: open }, { data: resolved }] = await Promise.all([
    db.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'forecast').filter('metadata->>status', 'eq', 'open').order('created_at', { ascending: false }).limit(3),
    db.from('persona_memory').select('metadata').eq('persona_id', PERSONA_ID).eq('memory_type', 'forecast').in('metadata->>status' as 'metadata', ['correct', 'incorrect']).order('created_at', { ascending: false }).limit(10),
  ]);

  const parts: string[] = [];
  if (open?.length) {
    parts.push('Open forecasts:');
    open.forEach((f) => {
      const m = f.metadata as unknown as ForecastRecord;
      const h = Math.round((Date.now() - new Date(m.created_at).getTime()) / 3_600_000);
      parts.push(`  - ${m.metric} ${m.direction} ${m.magnitude} [${h}h/${m.timeframe_hours}h elapsed]`);
    });
  }
  if (resolved?.length) {
    const total = resolved.length;
    const c     = resolved.filter((f) => (f.metadata as Record<string, unknown>).status === 'correct').length;
    parts.push(`Forecast accuracy: ${c}/${total} correct`);
  }
  return parts.join('\n');
}
