import { supabaseAdmin } from '@/lib/supabase';
import type { MarcusDataPull } from './data-pull';

const PERSONA_ID  = 'marcus-webb';
const WINDOW_SIZE = 30;

export interface MetricBaseline {
  mean:    number;
  std:     number;
  history: number[];  // last WINDOW_SIZE daily values
}

export interface MarcusBaseline {
  metrics: {
    btcExchangeNetflow: MetricBaseline;
    btcVolumeRatio:     MetricBaseline;
    btcHashrate:        MetricBaseline;
    mempoolTxCount:     MetricBaseline;
    fearGreedIndex:     MetricBaseline;
    minerOutflows:      MetricBaseline;
  };
  lastUpdated: string;
  samples:     number;  // total samples collected so far
}

// ── Defaults for first run ────────────────────────────────────────────────────

function emptyMetric(): MetricBaseline {
  return { mean: 0, std: 1, history: [] };
}

export function defaultBaseline(): MarcusBaseline {
  return {
    metrics: {
      btcExchangeNetflow: emptyMetric(),
      btcVolumeRatio:     { mean: 1, std: 0.3, history: [] },
      btcHashrate:        emptyMetric(),
      mempoolTxCount:     emptyMetric(),
      fearGreedIndex:     { mean: 50, std: 15, history: [] },
      minerOutflows:      emptyMetric(),
    },
    lastUpdated: new Date().toISOString(),
    samples:     0,
  };
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadBaseline(): Promise<MarcusBaseline> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('persona_memory')
    .select('metadata')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'baseline')
    .single();

  if (!data?.metadata) return defaultBaseline();
  return data.metadata as unknown as MarcusBaseline;
}

// ── Save ──────────────────────────────────────────────────────────────────────

async function saveBaseline(baseline: MarcusBaseline): Promise<void> {
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from('persona_memory')
    .select('id')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'baseline')
    .single();

  const content = `Baseline updated: ${baseline.samples} samples. Last: ${baseline.lastUpdated}`;

  if (existing?.id) {
    await db
      .from('persona_memory')
      .update({ content, metadata: baseline as unknown as Record<string, unknown> })
      .eq('id', existing.id);
  } else {
    await db.from('persona_memory').insert({
      persona_id:  PERSONA_ID,
      memory_type: 'baseline',
      content,
      metadata:    baseline as unknown as Record<string, unknown>,
    });
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

function updateMetric(metric: MetricBaseline, newValue: number): MetricBaseline {
  if (newValue === 0 && metric.history.length === 0) return metric; // skip zero values before first real data

  const history = [...metric.history, newValue].slice(-WINDOW_SIZE);
  const n       = history.length;
  const mean    = history.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1
    ? history.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
    : 1;
  const std = Math.max(Math.sqrt(variance), 0.001); // avoid division by zero

  return { mean, std, history };
}

export async function updateBaseline(data: MarcusDataPull): Promise<MarcusBaseline> {
  const current = await loadBaseline();

  const updated: MarcusBaseline = {
    metrics: {
      btcExchangeNetflow: updateMetric(current.metrics.btcExchangeNetflow, data.btcExchangeNetflow),
      btcVolumeRatio:     updateMetric(current.metrics.btcVolumeRatio,     data.btcVolumeRatio),
      btcHashrate:        updateMetric(current.metrics.btcHashrate,         data.btcHashrate),
      mempoolTxCount:     updateMetric(current.metrics.mempoolTxCount,      data.mempoolTxCount),
      fearGreedIndex:     updateMetric(current.metrics.fearGreedIndex,      data.fearGreedIndex),
      minerOutflows:      updateMetric(current.metrics.minerOutflows,       data.minerOutflows),
    },
    lastUpdated: new Date().toISOString(),
    samples:     current.samples + 1,
  };

  await saveBaseline(updated);
  return updated;
}

// ── z-score ───────────────────────────────────────────────────────────────────

export function zScore(value: number, metric: MetricBaseline): number {
  if (metric.std === 0) return 0;
  return (value - metric.mean) / metric.std;
}
