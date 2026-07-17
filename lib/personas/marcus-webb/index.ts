import { supabaseAdmin } from '@/lib/supabase';
import { publishArticleToSanity } from '@/lib/personas/shared';
import { generateMarcusCover } from '@/lib/personas/cover-images';
import { searchSimilarMemories, saveEmbedding } from '@/lib/personas/embeddings';
import type { MarcusDataPull } from './data-pull';
import { pullMarcusData } from './data-pull';
import { loadBaseline, updateBaseline } from './baseline';
import type { Anomaly } from './anomalies';
import { detectAnomalies } from './anomalies';
import { shouldWrite } from './should-write';
import { generateMarcusArticle } from './generate';
import { extractAndSaveForecast, getForecastContext } from './forecasts';
import { decideSelfWork, executeSelfWork, type SelfWorkResult } from './self-work';
import { extractAndSavePosition } from '../elena-voss/position'; // reuse same pattern
import { buildVerifiedHistory } from '@/lib/personas/verified-history';
import { isPersonaAtDailyCap, DAILY_ARTICLE_CAP } from '@/lib/automation/daily-cap';

const PERSONA_ID = 'marcus-webb';

export interface RunResult {
  wrote:             boolean;
  score?:            number;
  reasoning:         string;
  articleSlug?:      string;
  articleCategory?:  string;
  selfWork?:         SelfWorkResult;
  skippedInactive?:  boolean;
  skippedAlreadyWrote?: boolean;
  skippedDailyCap?:  boolean;
  error?:            string;
}

export async function runMarcusWebb(): Promise<RunResult> {
  const supabase = supabaseAdmin();

  // 0. is_active check
  const { data: persona } = await supabase.from('personas').select('is_active').eq('id', PERSONA_ID).single();
  if (!(persona as { is_active: boolean } | null)?.is_active) {
    return { wrote: false, reasoning: 'Persona is inactive', skippedInactive: true };
  }

  // 0a2. Daily cap — no LLM calls if already at the limit
  if (await isPersonaAtDailyCap(supabase, PERSONA_ID)) {
    return { wrote: false, reasoning: `Daily article cap reached (${DAILY_ARTICLE_CAP}/day) — run skipped`, skippedDailyCap: true };
  }

  // 0b. Second chance check: don't write twice in one day
  const today = new Date().toISOString().slice(0, 10);
  const { data: todayWrote } = await supabase
    .from('persona_runs')
    .select('id')
    .eq('persona_id', PERSONA_ID)
    .eq('run_date', today)
    .eq('should_write', true)
    .limit(1);
  if (todayWrote?.length) {
    return { wrote: false, reasoning: 'Already wrote today', skippedAlreadyWrote: true };
  }

  // 1. Pull data
  let data;
  try { data = await pullMarcusData(); }
  catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Data pull failed: ${error}`, data_snapshot: {} });
    return { wrote: false, score: 0, reasoning: `Data pull failed: ${error}`, error };
  }

  // 2. Load baseline
  const baseline = await loadBaseline();

  // 3. Detect anomalies
  const anomalies = detectAnomalies(data, baseline);
  await saveSignalSnapshot(supabase, data, anomalies);

  // 4. Build context
  const recentSummary = await buildContext(supabase, null);

  // 5. Editorial judgment
  let evalResult;
  try { evalResult = await shouldWrite(anomalies, baseline, recentSummary); }
  catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Eval failed: ${error}`, data_snapshot: data });
    return { wrote: false, score: 0, reasoning: `Eval failed: ${error}`, error };
  }

  // 6a. Score ≥ 60 — generate article
  if (evalResult.should_write && evalResult.score >= 60) {
    await logRun(supabase, {
      should_write: true, score: evalResult.score, reasoning: evalResult.reasoning,
      topic: evalResult.topic ?? undefined, primary_signal: evalResult.primary_metric ?? undefined, data_snapshot: data,
    });

    const contextWithTopic = evalResult.topic ? await buildContext(supabase, evalResult.topic) : recentSummary;
    const verifiedHistory = await buildVerifiedHistory(supabase, PERSONA_ID);

    let article;
    try { article = await generateMarcusArticle(data, anomalies, evalResult, baseline, contextWithTopic, verifiedHistory); }
    catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { wrote: false, score: evalResult.score, reasoning: `Generation failed: ${error}`, error };
    }

    // Generate data visualization cover (fire before publish, best-effort)
    const cover = await generateMarcusCover(data, baseline, anomalies, evalResult.primary_metric ?? null).catch(() => null);

    let slug: string, sanityId: string;
    try {
      const r = await publishArticleToSanity(article, PERSONA_ID, cover);
      slug = r.slug; sanityId = r.id;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { wrote: false, score: evalResult.score, reasoning: `Publish failed: ${error}`, error };
    }

    const memContent = `${article.title}\n\n${article.excerpt}`;
    const { data: memRow } = await supabase.from('persona_memory').insert({
      persona_id: PERSONA_ID, memory_type: 'article', content: memContent,
      metadata: { slug, title: article.title, topic: evalResult.topic, sanity_id: sanityId, tags: article.tags },
    }).select('id').single();

    if (memRow?.id) void saveEmbedding(memRow.id, memContent);
    void extractAndSaveForecast(article.title, article.body, slug, data);
    void extractAndSavePosition(article.title, article.excerpt, article.body);
    void updateBaseline(data);

    await supabase.from('persona_runs')
      .update({ article_slug: slug, article_id: sanityId })
      .eq('persona_id', PERSONA_ID).eq('run_date', today)
      .order('created_at', { ascending: false }).limit(1);

    return { wrote: true, score: evalResult.score, reasoning: evalResult.reasoning, articleSlug: slug, articleCategory: article.category };
  }

  // 6b. Score < 60 — self-work (always updates baseline + verifies forecasts)
  await logRun(supabase, {
    should_write: false, score: evalResult.score, reasoning: evalResult.reasoning, data_snapshot: data,
  });

  const selfWorkTask = await decideSelfWork();
  let selfWorkResult: SelfWorkResult;
  try { selfWorkResult = await executeSelfWork(selfWorkTask, data, baseline, recentSummary); }
  catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { wrote: false, score: evalResult.score, reasoning: `Self-work failed: ${error}`, error };
  }

  if (selfWorkResult.articleSlug) {
    await supabase.from('persona_runs')
      .update({ should_write: selfWorkResult.wrote, article_slug: selfWorkResult.articleSlug, topic: selfWorkResult.type, primary_signal: `self_work:${selfWorkResult.type}` })
      .eq('persona_id', PERSONA_ID).eq('run_date', today)
      .order('created_at', { ascending: false }).limit(1);
  }

  return { wrote: selfWorkResult.wrote, score: evalResult.score, reasoning: selfWorkResult.reasoning, selfWork: selfWorkResult };
}

// ── Context builder ───────────────────────────────────────────────────────────

async function buildContext(supabase: ReturnType<typeof supabaseAdmin>, topic?: string | null): Promise<string> {
  const [{ data: permanent }, { data: recent }, forecasts] = await Promise.all([
    supabase.from('persona_memory').select('content').eq('persona_id', PERSONA_ID).eq('memory_type', 'context'),
    supabase.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'article').order('created_at', { ascending: false }).limit(5),
    getForecastContext(),
  ]);

  const semantic = topic ? await searchSimilarMemories(PERSONA_ID, topic, 4) : [];
  const parts: string[] = [];

  if (permanent?.length) { parts.push("=== Marcus's on-chain framework ==="); permanent.forEach((m) => parts.push(m.content as string)); }
  if (forecasts)          { parts.push('=== Forecasts ==='); parts.push(forecasts); }
  if (semantic.length)    { parts.push('=== Similar past articles ==='); semantic.forEach((m) => { const meta = m.metadata as { title?: string }; parts.push(`- ${meta.title ?? ''} [${(m.similarity * 100).toFixed(0)}%]`); }); }
  if (recent?.length)     { parts.push('=== Recent articles ==='); recent.forEach((m) => { const meta = m.metadata as { title?: string; topic?: string; source?: string }; parts.push(`- ${meta.title ?? '(no title)'} [${meta.topic ?? meta.source ?? 'unknown'}]`); }); }

  const victorCtx = await buildVictorKaneContext(supabase, PERSONA_ID);
  if (victorCtx) parts.push(victorCtx);

  return parts.join('\n');
}

async function buildVictorKaneContext(supabase: ReturnType<typeof supabaseAdmin>, personaId: string): Promise<string | null> {
  const [{ data: feedback }, { data: pending }, { data: snapshots }] = await Promise.all([
    supabase.from('persona_memory').select('metadata').eq('persona_id', personaId).eq('memory_type', 'editor_feedback').order('created_at', { ascending: false }).limit(1),
    supabase.from('editorial_directives').select('directive, issued_date').eq('persona_id', personaId).eq('status', 'pending').order('issued_date', { ascending: false }).limit(1),
    supabase.from('persona_memory').select('content, created_at').eq('persona_id', personaId).eq('memory_type', 'signal_snapshot').order('created_at', { ascending: false }).limit(2),
  ]);
  if (!feedback?.length && !snapshots?.length) return null;
  const f = (feedback?.[0]?.metadata ?? {}) as { date?: string; score?: number; priority_fix?: string; directive?: string; pattern_warning?: string | null };
  const d = pending?.[0];
  if (!f.priority_fix && !d && !snapshots?.length) return null;
  const lines = ['=== Victor Kane — last directive ==='];
  if (f.score !== undefined) lines.push(`Score: ${f.score}/100 (${f.date ?? ''})`);
  if (f.priority_fix) lines.push(`Priority fix: "${f.priority_fix}"`);
  if (d) { lines.push(`Directive: "${d.directive}"`); lines.push(`Status: PENDING — this directive has not been addressed yet`); }
  else if (f.priority_fix) { lines.push(`Status: resolved — no active directive`); }
  lines.push(f.pattern_warning ? `Pattern: [WARNING] ${f.pattern_warning}` : `Pattern: [none]`);
  if (snapshots?.length) {
    lines.push('=== Signal data (last 2 snapshots) ===');
    snapshots.forEach((s, i) => lines.push(`[${i === 0 ? 'latest' : 'prev'}] ${s.content as string}`));
  }
  return lines.join('\n');
}

// ── Signal snapshot ───────────────────────────────────────────────────────────

async function saveSignalSnapshot(
  supabase: ReturnType<typeof supabaseAdmin>,
  data: MarcusDataPull,
  anomalies: Anomaly[]
): Promise<void> {
  try {
    const topAnomalies = anomalies.slice(0, 3).map((a) => `${a.metric}(z:${a.zScore.toFixed(1)}): ${a.context}`);
    const content = [
      `Signal snapshot — ${data.pulledAt}`,
      `BTC: $${data.btcPrice.toLocaleString()} | Vol ratio: ${data.btcVolumeRatio.toFixed(2)}x | Dom: ${data.btcDominance.toFixed(1)}%`,
      `Exchange netflow: ${data.btcExchangeNetflow >= 0 ? '+' : ''}${data.btcExchangeNetflow.toFixed(0)} BTC | Miner outflows: ${data.minerOutflows.toFixed(0)} BTC`,
      `Hashrate: ${(data.btcHashrate / 1e6).toFixed(1)} EH/s | Fear&Greed: ${data.fearGreedIndex}`,
      `Top anomalies: ${topAnomalies.join(' | ') || 'none'}`,
    ].join('\n');

    await supabase.from('persona_memory').insert({
      persona_id:  PERSONA_ID,
      memory_type: 'signal_snapshot',
      content,
      metadata: {
        btcPrice:           data.btcPrice,
        btcVolumeRatio:     data.btcVolumeRatio,
        btcDominance:       data.btcDominance,
        btcExchangeNetflow: data.btcExchangeNetflow,
        minerOutflows:      data.minerOutflows,
        mempoolTxCount:     data.mempoolTxCount,
        mempoolAvgFeeRate:  data.mempoolAvgFeeRate,
        btcHashrate:        data.btcHashrate,
        fearGreedIndex:     data.fearGreedIndex,
        topAnomalies:       anomalies.slice(0, 3).map((a) => ({ metric: a.metric, zScore: a.zScore, direction: a.direction })),
        pulledAt:           data.pulledAt,
      },
    });
  } catch { /* non-critical — run continues */ }
}

// ── Public context inspector ──────────────────────────────────────────────────

export async function getMarcusContext(topic?: string): Promise<Array<{ label: string; content: string; empty: boolean }>> {
  const supabase = supabaseAdmin();
  const [{ data: permanent }, { data: recent }, { data: allMem }, { data: baselineRow }, forecasts] = await Promise.all([
    supabase.from('persona_memory').select('content').eq('persona_id', PERSONA_ID).eq('memory_type', 'context'),
    supabase.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'article').order('created_at', { ascending: false }).limit(5),
    supabase.from('persona_memory').select('id, memory_type').eq('persona_id', PERSONA_ID),
    supabase.from('persona_memory').select('metadata').eq('persona_id', PERSONA_ID).eq('memory_type', 'baseline').single(),
    getForecastContext(),
  ]);

  const semantic = topic ? await searchSimilarMemories(PERSONA_ID, topic, 4) : [];
  const stats = { total: allMem?.length ?? 0, articles: allMem?.filter((r) => r.memory_type === 'article').length ?? 0 };
  const bm = baselineRow?.metadata as { samples?: number; lastUpdated?: string } | null;

  return [
    { label: 'Memory stats', content: `Total: ${stats.total} | articles: ${stats.articles} | baseline samples: ${bm?.samples ?? 0}`, empty: stats.total === 0 },
    { label: '1. On-chain framework (bootstrap)', content: permanent?.length ? permanent.map((m) => m.content as string).join('\n\n') : '(empty)', empty: !permanent?.length },
    { label: '2. Forecasts', content: forecasts || '(empty)', empty: !forecasts },
    { label: `3. Semantic search${topic ? ` for "${topic}"` : ' (no topic)'}`, content: semantic.length ? semantic.map((m) => `[${(m.similarity * 100).toFixed(0)}%] ${(m.metadata as { title?: string }).title ?? ''}`).join('\n') : '(empty)', empty: semantic.length === 0 },
    { label: `4. Recent articles (${recent?.length ?? 0})`, content: recent?.length ? recent.map((m) => { const meta = m.metadata as { title?: string; topic?: string; source?: string }; return `- ${meta.title ?? '(no title)'} [${meta.topic ?? meta.source ?? 'unknown'}]`; }).join('\n') : '(empty)', empty: !recent?.length },
  ];
}

async function logRun(supabase: ReturnType<typeof supabaseAdmin>, run: { should_write: boolean; score: number; reasoning: string; topic?: string; primary_signal?: string; data_snapshot: unknown }) {
  await supabase.from('persona_runs').insert({
    persona_id: PERSONA_ID, should_write: run.should_write, score: run.score,
    reasoning: run.reasoning, topic: run.topic ?? null, primary_signal: run.primary_signal ?? null, data_snapshot: run.data_snapshot,
  });
}
