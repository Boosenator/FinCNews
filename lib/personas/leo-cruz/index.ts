import { supabaseAdmin } from '@/lib/supabase';
import { publishArticleToSanity } from '@/lib/personas/shared';
import { searchSimilarMemories, saveEmbedding } from '@/lib/personas/embeddings';
import { pullLeoData } from './data-pull';
import { detectSignals } from './signals';
import { loadNarrativeHistory, updateNarrativeTracker, markNarrativeCovered } from './narratives';
import { shouldWrite } from './should-write';
import { generateLeoArticle } from './generate';
import { decideSelfWork, executeSelfWork, type SelfWorkResult } from './self-work';

const PERSONA_ID = 'leo-cruz';

export interface RunResult {
  wrote:            boolean;
  score?:           number;
  reasoning:        string;
  articleSlug?:     string;
  articleCategory?: string;
  selfWork?:        SelfWorkResult;
  skippedInactive?: boolean;
  error?:           string;
}

export async function runLeoCruz(): Promise<RunResult> {
  const supabase = supabaseAdmin();

  // 0. is_active check
  const { data: persona } = await supabase
    .from('personas')
    .select('is_active')
    .eq('id', PERSONA_ID)
    .single();

  if (!(persona as { is_active: boolean } | null)?.is_active) {
    return { wrote: false, reasoning: 'Persona is inactive', skippedInactive: true };
  }

  // 1. Pull data
  let data;
  try {
    data = await pullLeoData();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Data pull failed: ${error}`, data_snapshot: {} });
    return { wrote: false, score: 0, reasoning: `Data pull failed: ${error}`, error };
  }

  // 2. Load narrative history + detect signals
  const narratives = await loadNarrativeHistory();
  const signals    = detectSignals(data, narratives);

  // 3. Build context
  const recentSummary = await buildContext(supabase, null);

  // 4. Editorial judgment
  let evalResult;
  try {
    evalResult = await shouldWrite(signals, narratives, data, recentSummary);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Eval failed: ${error}`, data_snapshot: data });
    return { wrote: false, score: 0, reasoning: `Eval failed: ${error}`, error };
  }

  // 5a. Score ≥ 60 — generate event-driven article
  if (evalResult.should_write && evalResult.score >= 60) {
    await logRun(supabase, {
      should_write:   true,
      score:          evalResult.score,
      reasoning:      evalResult.reasoning,
      topic:          evalResult.topic ?? undefined,
      primary_signal: evalResult.primary_signals?.[0] ?? undefined,
      data_snapshot:  data,
    });

    // Rebuild context with known topic for semantic search
    const contextWithTopic = evalResult.topic
      ? await buildContext(supabase, evalResult.topic)
      : recentSummary;

    let article;
    try {
      article = await generateLeoArticle(data, signals, evalResult, narratives, contextWithTopic);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { wrote: false, score: evalResult.score, reasoning: `Generation failed: ${error}`, error };
    }

    let slug: string;
    let sanityId: string;
    try {
      const result = await publishArticleToSanity(article, PERSONA_ID);
      slug = result.slug;
      sanityId = result.id;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { wrote: false, score: evalResult.score, reasoning: `Publish failed: ${error}`, error };
    }

    const memContent = `${article.title}\n\n${article.excerpt}`;
    const { data: memRow } = await supabase.from('persona_memory').insert({
      persona_id:  PERSONA_ID,
      memory_type: 'article',
      content:     memContent,
      metadata: { slug, title: article.title, topic: evalResult.topic, sanity_id: sanityId, tags: article.tags },
    }).select('id').single();

    // Fire-and-forget
    if (memRow?.id) void saveEmbedding(memRow.id, memContent);
    if (evalResult.topic) void markNarrativeCovered(evalResult.topic, slug);
    void updateNarrativeTracker(data.trendingCoins);

    await supabase
      .from('persona_runs')
      .update({ article_slug: slug, article_id: sanityId })
      .eq('persona_id', PERSONA_ID)
      .eq('run_date', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(1);

    return { wrote: true, score: evalResult.score, reasoning: evalResult.reasoning, articleSlug: slug, articleCategory: article.category };
  }

  // 5b. Score < 60 — self-work (ALWAYS updates tracker)
  await logRun(supabase, {
    should_write:  false,
    score:         evalResult.score,
    reasoning:     evalResult.reasoning,
    data_snapshot: data,
  });

  const selfWorkTask = await decideSelfWork();
  let selfWorkResult: SelfWorkResult;
  try {
    selfWorkResult = await executeSelfWork(selfWorkTask, data, narratives, recentSummary);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { wrote: false, score: evalResult.score, reasoning: `Self-work failed: ${error}`, error };
  }

  if (selfWorkResult.articleSlug) {
    await supabase
      .from('persona_runs')
      .update({
        should_write:   selfWorkResult.wrote,
        article_slug:   selfWorkResult.articleSlug,
        topic:          selfWorkResult.type,
        primary_signal: `self_work:${selfWorkResult.type}`,
      })
      .eq('persona_id', PERSONA_ID)
      .eq('run_date', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(1);
  }

  return {
    wrote:        selfWorkResult.wrote,
    score:        evalResult.score,
    reasoning:    selfWorkResult.reasoning,
    articleSlug:  selfWorkResult.articleSlug,
    articleCategory: selfWorkResult.articleCategory,
    selfWork:     selfWorkResult,
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

async function buildContext(supabase: ReturnType<typeof supabaseAdmin>, topic?: string | null): Promise<string> {
  const [{ data: permanent }, { data: recent }, { data: narrativeMemory }] = await Promise.all([
    supabase.from('persona_memory').select('content').eq('persona_id', PERSONA_ID).eq('memory_type', 'context'),
    supabase.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'article').order('created_at', { ascending: false }).limit(5),
    supabase.from('persona_memory').select('content').eq('persona_id', PERSONA_ID).eq('memory_type', 'narrative').neq('metadata->>currentStage', 'dead'),
  ]);

  const semanticMatches = topic ? await searchSimilarMemories(PERSONA_ID, topic, 4) : [];
  const parts: string[] = [];

  if (permanent?.length) {
    parts.push("=== Leo's narrative framework ===");
    permanent.forEach((m) => parts.push(m.content as string));
  }

  if (narrativeMemory?.length) {
    parts.push('=== Active narrative tracker ===');
    narrativeMemory.forEach((m) => parts.push(m.content as string));
  }

  if (semanticMatches.length > 0) {
    parts.push('=== Similar past articles ===');
    semanticMatches.forEach((m) => {
      const meta = m.metadata as { title?: string };
      parts.push(`- ${meta.title ?? m.content.slice(0, 80)} [${(m.similarity * 100).toFixed(0)}%]`);
    });
  }

  if (recent?.length) {
    parts.push('=== Recent articles ===');
    recent.forEach((m) => {
      const meta = m.metadata as { title?: string; topic?: string };
      parts.push(`- ${meta.title ?? '(no title)'} [topic: ${meta.topic ?? 'unknown'}]`);
    });
  }

  const victorCtx = await buildVictorKaneContext(supabase, PERSONA_ID);
  if (victorCtx) parts.push(victorCtx);

  return parts.join('\n');
}

async function buildVictorKaneContext(supabase: ReturnType<typeof supabaseAdmin>, personaId: string): Promise<string | null> {
  const [{ data: feedback }, { data: pending }] = await Promise.all([
    supabase.from('persona_memory').select('metadata').eq('persona_id', personaId).eq('memory_type', 'editor_feedback').order('created_at', { ascending: false }).limit(1),
    supabase.from('editorial_directives').select('directive, issued_date').eq('persona_id', personaId).eq('status', 'pending').order('issued_date', { ascending: false }).limit(1),
  ]);
  if (!feedback?.length) return null;
  const f = feedback[0].metadata as { date?: string; score?: number; priority_fix?: string; directive?: string; pattern_warning?: string | null };
  const d = pending?.[0];
  if (!f.priority_fix && !d) return null;
  const lines = ['=== Victor Kane — last directive ==='];
  if (f.score !== undefined) lines.push(`Score: ${f.score}/100 (${f.date ?? ''})`);
  if (f.priority_fix) lines.push(`Priority fix: "${f.priority_fix}"`);
  if (d) { lines.push(`Directive: "${d.directive}"`); lines.push(`Status: PENDING — this directive has not been addressed yet`); }
  else { lines.push(`Status: resolved — no active directive`); }
  lines.push(f.pattern_warning ? `Pattern: [WARNING] ${f.pattern_warning}` : `Pattern: [none]`);
  return lines.join('\n');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function getLeoContext(topic?: string): Promise<Array<{ label: string; content: string; empty: boolean }>> {
  const supabase = supabaseAdmin();

  const [{ data: permanent }, { data: recent }, { data: narrativeMemory }, { data: allMem }] = await Promise.all([
    supabase.from('persona_memory').select('content').eq('persona_id', PERSONA_ID).eq('memory_type', 'context'),
    supabase.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'article').order('created_at', { ascending: false }).limit(5),
    supabase.from('persona_memory').select('content, metadata').eq('persona_id', PERSONA_ID).eq('memory_type', 'narrative').neq('metadata->>currentStage', 'dead'),
    supabase.from('persona_memory').select('id, memory_type').eq('persona_id', PERSONA_ID),
  ]);

  const semantic = topic ? await searchSimilarMemories(PERSONA_ID, topic, 4) : [];
  const stats = {
    total:     allMem?.length ?? 0,
    articles:  allMem?.filter((r) => r.memory_type === 'article').length ?? 0,
    narratives: allMem?.filter((r) => r.memory_type === 'narrative').length ?? 0,
  };

  return [
    {
      label:   'Memory stats',
      content: `Total: ${stats.total} | articles: ${stats.articles} | narratives: ${stats.narratives}`,
      empty:   stats.total === 0,
    },
    {
      label:   '1. Narrative framework (bootstrap)',
      content: permanent?.length ? permanent.map((m) => m.content as string).join('\n\n') : '(empty)',
      empty:   !permanent?.length,
    },
    {
      label:   `2. Active narrative tracker (${narrativeMemory?.length ?? 0} narratives)`,
      content: narrativeMemory?.length ? narrativeMemory.map((m) => m.content as string).join('\n') : '(empty)',
      empty:   !narrativeMemory?.length,
    },
    {
      label:   `3. Semantic search${topic ? ` for "${topic}"` : ' (no topic)'}`,
      content: semantic.length ? semantic.map((m) => `[${(m.similarity * 100).toFixed(0)}%] ${(m.metadata as { title?: string }).title ?? ''}` ).join('\n') : '(empty)',
      empty:   semantic.length === 0,
    },
    {
      label:   `4. Recent articles (${recent?.length ?? 0})`,
      content: recent?.length ? recent.map((m) => { const meta = m.metadata as { title?: string; topic?: string }; return `- ${meta.title ?? '(no title)'} [${meta.topic ?? 'unknown'}]`; }).join('\n') : '(empty)',
      empty:   !recent?.length,
    },
  ];
}

async function logRun(
  supabase: ReturnType<typeof supabaseAdmin>,
  run: { should_write: boolean; score: number; reasoning: string; topic?: string; primary_signal?: string; data_snapshot: unknown }
) {
  await supabase.from('persona_runs').insert({
    persona_id:     PERSONA_ID,
    should_write:   run.should_write,
    score:          run.score,
    reasoning:      run.reasoning,
    topic:          run.topic ?? null,
    primary_signal: run.primary_signal ?? null,
    data_snapshot:  run.data_snapshot,
  });
}
