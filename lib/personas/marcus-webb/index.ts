import { supabaseAdmin } from '@/lib/supabase';
import { publishArticleToSanity } from '@/lib/personas/shared';
import { searchSimilarMemories, saveEmbedding } from '@/lib/personas/embeddings';
import { pullMarcusData } from './data-pull';
import { loadBaseline, updateBaseline } from './baseline';
import { detectAnomalies } from './anomalies';
import { shouldWrite } from './should-write';
import { generateMarcusArticle } from './generate';
import { extractAndSaveForecast, getForecastContext } from './forecasts';
import { decideSelfWork, executeSelfWork, type SelfWorkResult } from './self-work';
import { extractAndSavePosition } from '../elena-voss/position'; // reuse same pattern

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
  error?:            string;
}

export async function runMarcusWebb(): Promise<RunResult> {
  const supabase = supabaseAdmin();

  // 0. is_active check
  const { data: persona } = await supabase.from('personas').select('is_active').eq('id', PERSONA_ID).single();
  if (!(persona as { is_active: boolean } | null)?.is_active) {
    return { wrote: false, reasoning: 'Persona is inactive', skippedInactive: true };
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

    let article;
    try { article = await generateMarcusArticle(data, anomalies, evalResult, baseline, contextWithTopic); }
    catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { wrote: false, score: evalResult.score, reasoning: `Generation failed: ${error}`, error };
    }

    let slug: string, sanityId: string;
    try {
      const r = await publishArticleToSanity(article, PERSONA_ID);
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
    void extractAndSaveForecast(article.title, article.body, slug, data.btcPrice);
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
  if (recent?.length)     { parts.push('=== Recent articles ==='); recent.forEach((m) => { const meta = m.metadata as { title?: string; topic?: string }; parts.push(`- ${meta.title ?? '(no title)'} [${meta.topic ?? 'unknown'}]`); }); }

  return parts.join('\n');
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
    { label: `4. Recent articles (${recent?.length ?? 0})`, content: recent?.length ? recent.map((m) => { const meta = m.metadata as { title?: string; topic?: string }; return `- ${meta.title ?? '(no title)'} [${meta.topic ?? 'unknown'}]`; }).join('\n') : '(empty)', empty: !recent?.length },
  ];
}

async function logRun(supabase: ReturnType<typeof supabaseAdmin>, run: { should_write: boolean; score: number; reasoning: string; topic?: string; primary_signal?: string; data_snapshot: unknown }) {
  await supabase.from('persona_runs').insert({
    persona_id: PERSONA_ID, should_write: run.should_write, score: run.score,
    reasoning: run.reasoning, topic: run.topic ?? null, primary_signal: run.primary_signal ?? null, data_snapshot: run.data_snapshot,
  });
}
