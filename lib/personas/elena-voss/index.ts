import { supabaseAdmin } from '@/lib/supabase';
import { publishArticleToSanity } from '@/lib/personas/shared';
import { searchSimilarMemories, saveEmbedding } from '@/lib/personas/embeddings';
import { pullElenaData } from './data-pull';
import { shouldWrite } from './should-write';
import { generateElenaArticle } from './generate';
import { decideSelfWork, executeSelfWork, type SelfWorkResult } from './self-work';
import { extractAndSaveForecast, getOpenForecastsContext } from './forecasts';
import { extractAndSavePosition, getCurrentPosition } from './position';

const PERSONA_ID = 'elena-voss';

export interface RunResult {
  wrote: boolean;
  score?: number;
  reasoning: string;
  articleSlug?: string;
  articleCategory?: string;
  selfWork?: SelfWorkResult;
  skippedInactive?: boolean;
  error?: string;
}

export async function runElenaVoss(): Promise<RunResult> {
  const supabase = supabaseAdmin();

  // 0. Check is_active — cron respects this flag
  const { data: persona } = await supabase
    .from('personas')
    .select('is_active')
    .eq('id', PERSONA_ID)
    .single();

  if (!(persona as { is_active: boolean } | null)?.is_active) {
    return { wrote: false, reasoning: 'Persona is inactive', skippedInactive: true };
  }

  // 1. Pull live macro data
  let data;
  try {
    data = await pullElenaData();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Data pull failed: ${error}`, data_snapshot: {} });
    return { wrote: false, score: 0, reasoning: `Data pull failed: ${error}`, error };
  }

  // 2. Build context (populated after should_write to know the topic)
  const recentSummary = await buildContext(supabase, null);

  // 3. Editorial judgment
  let evalResult;
  try {
    evalResult = await shouldWrite(data, recentSummary);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Eval failed: ${error}`, data_snapshot: data });
    return { wrote: false, score: 0, reasoning: `Eval failed: ${error}`, error };
  }

  // 2b. Rebuild context with known topic for semantic search
  const contextWithTopic = evalResult.topic
    ? await buildContext(supabase, evalResult.topic)
    : recentSummary;

  // 4a. Score ≥ 60 — generate and publish event-driven article
  if (evalResult.should_write && evalResult.score >= 60) {
    await logRun(supabase, {
      should_write: true,
      score: evalResult.score,
      reasoning: evalResult.reasoning,
      topic: evalResult.topic ?? undefined,
      primary_signal: evalResult.primary_signal ?? undefined,
      data_snapshot: data,
    });

    let article;
    try {
      article = await generateElenaArticle(data, evalResult, contextWithTopic);
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
      metadata: {
        slug,
        title:     article.title,
        topic:     evalResult.topic,
        sanity_id: sanityId,
        tags:      article.tags,
      },
    }).select('id').single();

    // Fire-and-forget: embed, extract forecast, extract position (never block main flow)
    if (memRow?.id) void saveEmbedding(memRow.id, memContent);
    void extractAndSaveForecast(article.title, article.body, slug);
    void extractAndSavePosition(article.title, article.excerpt, article.body);

    await supabase
      .from('persona_runs')
      .update({ article_slug: slug, article_id: sanityId })
      .eq('persona_id', PERSONA_ID)
      .eq('run_date', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(1);

    return {
      wrote: true,
      score: evalResult.score,
      reasoning: evalResult.reasoning,
      articleSlug: slug,
      articleCategory: article.category,
    };
  }

  // 4b. Score < 60 — decide self-work
  await logRun(supabase, {
    should_write: false,
    score: evalResult.score,
    reasoning: evalResult.reasoning,
    data_snapshot: data,
  });

  const selfWorkTask = await decideSelfWork();

  if (!selfWorkTask) {
    return { wrote: false, score: evalResult.score, reasoning: evalResult.reasoning };
  }

  // Execute self-work
  let selfWorkResult: SelfWorkResult;
  try {
    selfWorkResult = await executeSelfWork(selfWorkTask, data, recentSummary);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { wrote: false, score: evalResult.score, reasoning: `Self-work failed: ${error}`, error };
  }

  // Update run log with self-work article
  if (selfWorkResult.articleSlug) {
    await supabase
      .from('persona_runs')
      .update({
        should_write: true,
        article_slug: selfWorkResult.articleSlug,
        topic: selfWorkResult.type,
        primary_signal: `self_work:${selfWorkResult.type}`,
      })
      .eq('persona_id', PERSONA_ID)
      .eq('run_date', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(1);
  }

  return {
    wrote: selfWorkResult.wrote,
    score: evalResult.score,
    reasoning: selfWorkResult.reasoning,
    articleSlug: selfWorkResult.articleSlug,
    articleCategory: selfWorkResult.articleCategory,
    selfWork: selfWorkResult,
  };
}

// ─── Public context inspector (for admin UI) ─────────────────────────────────

export interface ContextLayer {
  label: string;
  content: string;
  empty: boolean;
}

export async function getElenaContext(topic?: string): Promise<ContextLayer[]> {
  const supabase = supabaseAdmin();
  const [
    { data: permanent },
    { data: recent },
    { data: allArticles },
    { data: forecastRows },
    position,
    semanticMatches,
  ] = await Promise.all([
    supabase.from('persona_memory').select('content, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'context'),
    supabase.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'article').order('created_at', { ascending: false }).limit(5),
    supabase.from('persona_memory').select('id, memory_type, created_at').eq('persona_id', PERSONA_ID),
    supabase.from('persona_memory').select('content, metadata, created_at').eq('persona_id', PERSONA_ID).eq('memory_type', 'forecast').order('created_at', { ascending: false }).limit(10),
    getCurrentPosition(),
    topic ? searchSimilarMemories(PERSONA_ID, topic, 4) : Promise.resolve([]),
  ]);

  const stats = {
    total:     allArticles?.length ?? 0,
    articles:  allArticles?.filter(r => r.memory_type === 'article').length ?? 0,
    context:   allArticles?.filter(r => r.memory_type === 'context').length ?? 0,
    forecasts: allArticles?.filter(r => r.memory_type === 'forecast').length ?? 0,
    positions: allArticles?.filter(r => r.memory_type === 'position').length ?? 0,
  };

  const layers: ContextLayer[] = [];

  // Layer 0: stats
  layers.push({
    label: 'Memory stats',
    content: [
      `Total records: ${stats.total}`,
      `  articles: ${stats.articles}  |  context: ${stats.context}  |  forecasts: ${stats.forecasts}  |  positions: ${stats.positions}`,
    ].join('\n'),
    empty: stats.total === 0,
  });

  // Layer 1: bootstrap / permanent context
  layers.push({
    label: '1. Analytical foundation (context memories)',
    content: permanent?.length
      ? permanent.map(m => m.content as string).join('\n\n---\n\n')
      : '(empty — bootstrap article not yet written)',
    empty: !permanent?.length,
  });

  // Layer 2: current position
  layers.push({
    label: '2. Current position',
    content: position
      ? `Stance: ${position.stance} on ${position.on}\nRegime: ${position.regime}\nConviction: ${position.conviction}\nUpdated: ${position.updated_at}`
      : '(empty — position not yet extracted)',
    empty: !position,
  });

  // Layer 3: forecasts
  const openForecasts  = forecastRows?.filter(f => (f.metadata as Record<string, unknown>).status === 'open') ?? [];
  const closedForecasts = forecastRows?.filter(f => (f.metadata as Record<string, unknown>).status !== 'open') ?? [];
  layers.push({
    label: `3. Forecasts (${openForecasts.length} open, ${closedForecasts.length} resolved)`,
    content: forecastRows?.length
      ? forecastRows.map(f => {
          const m = f.metadata as Record<string, unknown>;
          const age = Math.round((Date.now() - new Date(f.created_at as string).getTime()) / 3_600_000);
          return `[${String(m.status).toUpperCase()}] ${String(m.metric)} ${String(m.direction)} ${String(m.magnitude ?? '')} — "${String(m.statement ?? '')}" (${age}h ago)`;
        }).join('\n')
      : '(empty — no forecasts extracted yet)',
    empty: !forecastRows?.length,
  });

  // Layer 4: semantic matches
  layers.push({
    label: `4. Semantic search${topic ? ` for "${topic}"` : ' (no topic provided)'}`,
    content: semanticMatches.length
      ? semanticMatches.map(m => {
          const meta = m.metadata as { title?: string; slug?: string };
          return `[${(m.similarity * 100).toFixed(0)}%] ${meta.title ?? '(no title)'} → /economy/${meta.slug ?? ''}`;
        }).join('\n')
      : topic
        ? '(no similar articles found — embeddings may not be populated yet)'
        : '(provide a topic to see semantic results)',
    empty: semanticMatches.length === 0,
  });

  // Layer 5: recent articles
  layers.push({
    label: `5. Recent articles (last ${recent?.length ?? 0} of ${stats.articles})`,
    content: recent?.length
      ? recent.map((m, i) => {
          const meta = m.metadata as { title?: string; topic?: string; slug?: string; self_work?: boolean };
          const age  = Math.round((Date.now() - new Date(m.created_at as string).getTime()) / 3_600_000);
          const sw   = meta.self_work ? ' [self-work]' : '';
          return `${i + 1}. ${meta.title ?? '(no title)'}${sw}\n   topic: ${meta.topic ?? 'unknown'}  |  ${age}h ago  |  /economy/${meta.slug ?? ''}`;
        }).join('\n\n')
      : '(empty — no articles published yet)',
    empty: !recent?.length,
  });

  return layers;
}

// ─── Context builder ─────────────────────────────────────────────────────────
// 1. Permanent context (bootstrap manifesto) — always loaded
// 2. Recent 5 articles (chronological)
// 3. Semantically similar articles (pgvector) — if topic + OPENAI_API_KEY available
// 4. Active forecasts + track record
// 5. Current position

async function buildContext(
  supabase: ReturnType<typeof supabaseAdmin>,
  topic?: string | null
): Promise<string> {
  const [
    { data: permanent },
    { data: recent },
    forecasts,
    position,
  ] = await Promise.all([
    supabase
      .from('persona_memory')
      .select('content')
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'context'),
    supabase
      .from('persona_memory')
      .select('content, metadata, created_at')
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'article')
      .order('created_at', { ascending: false })
      .limit(5),
    getOpenForecastsContext(),
    getCurrentPosition(),
  ]);

  // Semantic search — only if topic is available and OPENAI_API_KEY is set
  const semanticMatches = topic
    ? await searchSimilarMemories(PERSONA_ID, topic, 4)
    : [];

  const parts: string[] = [];

  if (permanent?.length) {
    parts.push("=== Elena's analytical foundation ===");
    permanent.forEach(m => parts.push(m.content as string));
  }

  if (position) {
    parts.push('=== Current position ===');
    parts.push(`Stance: ${position.stance} on ${position.on}`);
    parts.push(`Regime: ${position.regime}`);
    parts.push(`Conviction: ${position.conviction}`);
  }

  if (forecasts) {
    parts.push('=== Forecasts ===');
    parts.push(forecasts);
  }

  if (semanticMatches.length > 0) {
    parts.push('=== Semantically related past articles ===');
    semanticMatches.forEach(m => {
      const meta = m.metadata as { title?: string };
      parts.push(`- ${meta.title ?? m.content.slice(0, 80)} [similarity: ${(m.similarity * 100).toFixed(0)}%]`);
    });
  }

  if (recent?.length) {
    parts.push('=== Recent articles (chronological) ===');
    recent.forEach(m => {
      const meta = m.metadata as { title?: string; topic?: string };
      parts.push(`- ${meta.title ?? '(no title)'} [topic: ${meta.topic ?? 'unknown'}]`);
    });
  }

  // Victor Kane editorial feedback — last pending directive
  const victorFeedback = await buildVictorKaneContext(supabase);
  if (victorFeedback) parts.push(victorFeedback);

  return parts.join('\n');
}

async function buildVictorKaneContext(supabase: ReturnType<typeof supabaseAdmin>): Promise<string | null> {
  const [{ data: feedback }, { data: pendingDirective }] = await Promise.all([
    supabase
      .from('persona_memory')
      .select('content, metadata, created_at')
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'editor_feedback')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('editorial_directives')
      .select('directive, issued_date, status')
      .eq('persona_id', PERSONA_ID)
      .eq('status', 'pending')
      .order('issued_date', { ascending: false })
      .limit(1),
  ]);

  if (!feedback?.length) return null;

  const f = feedback[0].metadata as {
    date?: string; score?: number; priority_fix?: string;
    directive?: string; pattern_warning?: string | null;
  };

  const directive = pendingDirective?.[0];
  if (!directive && !f.priority_fix) return null;

  const lines = ['=== Victor Kane — last directive ==='];
  if (f.score !== undefined) lines.push(`Score: ${f.score}/100 (${f.date ?? ''})`);
  if (f.priority_fix) lines.push(`Priority fix: "${f.priority_fix}"`);
  if (directive) {
    lines.push(`Directive: "${directive.directive}"`);
    lines.push(`Status: PENDING — this directive has not been addressed yet`);
  } else {
    lines.push(`Status: resolved — no active directive`);
  }
  if (f.pattern_warning) lines.push(`Pattern: [WARNING] ${f.pattern_warning}`);
  else lines.push(`Pattern: [none]`);

  return lines.join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function logRun(
  supabase: ReturnType<typeof supabaseAdmin>,
  run: {
    should_write: boolean;
    score: number;
    reasoning: string;
    topic?: string;
    primary_signal?: string;
    data_snapshot: unknown;
  }
) {
  await supabase.from('persona_runs').insert({
    persona_id:    PERSONA_ID,
    should_write:  run.should_write,
    score:         run.score,
    reasoning:     run.reasoning,
    topic:         run.topic ?? null,
    primary_signal: run.primary_signal ?? null,
    data_snapshot: run.data_snapshot,
  });
}
