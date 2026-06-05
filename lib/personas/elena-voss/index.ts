import { supabaseAdmin } from '@/lib/supabase';
import { publishArticleToSanity } from '@/lib/personas/shared';
import { pullElenaData } from './data-pull';
import { shouldWrite } from './should-write';
import { generateElenaArticle } from './generate';
import { decideSelfWork, executeSelfWork, type SelfWorkResult } from './self-work';

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

  // 2. Build context: recent articles + permanent context memories (bootstrap)
  const recentSummary = await buildContext(supabase);

  // 3. Editorial judgment
  let evalResult;
  try {
    evalResult = await shouldWrite(data, recentSummary);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Eval failed: ${error}`, data_snapshot: data });
    return { wrote: false, score: 0, reasoning: `Eval failed: ${error}`, error };
  }

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
      article = await generateElenaArticle(data, evalResult, recentSummary);
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

    await supabase.from('persona_memory').insert({
      persona_id:  PERSONA_ID,
      memory_type: 'article',
      content:     `${article.title}\n\n${article.excerpt}`,
      metadata: {
        slug,
        title:     article.title,
        topic:     evalResult.topic,
        sanity_id: sanityId,
        tags:      article.tags,
      },
    });

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

  const selfWorkTask = await decideSelfWork(data);

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

// ─── Context builder ─────────────────────────────────────────────────────────
// Includes: recent 5 articles + all 'context' memories (bootstrap/manifesto)

async function buildContext(supabase: ReturnType<typeof supabaseAdmin>): Promise<string> {
  const [{ data: recent }, { data: permanent }] = await Promise.all([
    supabase
      .from('persona_memory')
      .select('content, metadata, created_at')
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'article')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('persona_memory')
      .select('content, metadata')
      .eq('persona_id', PERSONA_ID)
      .eq('memory_type', 'context'),
  ]);

  const parts: string[] = [];

  if (permanent?.length) {
    parts.push('=== Elena\'s established framework (always in context) ===');
    permanent.forEach(m => parts.push(m.content as string));
  }

  if (recent?.length) {
    parts.push('=== Recent articles ===');
    recent.forEach(m => {
      const meta = m.metadata as { title?: string; topic?: string };
      parts.push(`- ${meta.title ?? '(no title)'} [topic: ${meta.topic ?? 'unknown'}]`);
    });
  }

  return parts.join('\n');
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
