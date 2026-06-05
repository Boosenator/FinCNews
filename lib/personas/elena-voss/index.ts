import { createClient } from '@sanity/client';
import { supabaseAdmin } from '@/lib/supabase';
import { pullElenaData } from './data-pull';
import { shouldWrite } from './should-write';
import { generateElenaArticle } from './generate';

const PERSONA_ID = 'elena-voss';
const PERSONA_NAME = 'Elena Voss';
const AVATAR_PATH = '/authors/elena-voss.png';

interface RunResult {
  wrote: boolean;
  score: number;
  reasoning: string;
  articleSlug?: string;
  error?: string;
}

export async function runElenaVoss(): Promise<RunResult> {
  const supabase = supabaseAdmin();

  // 1. Pull live macro data
  let data;
  try {
    data = await pullElenaData();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Data pull failed: ${error}`, data_snapshot: {} });
    return { wrote: false, score: 0, reasoning: `Data pull failed: ${error}`, error };
  }

  // 2. Get recent articles for context (last 48h)
  const recentSummary = await getRecentArticleSummaries(supabase);

  // 3. Editorial judgment
  let evalResult;
  try {
    evalResult = await shouldWrite(data, recentSummary);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logRun(supabase, { should_write: false, score: 0, reasoning: `Eval failed: ${error}`, data_snapshot: data });
    return { wrote: false, score: 0, reasoning: `Eval failed: ${error}`, error };
  }

  await logRun(supabase, {
    should_write: evalResult.should_write,
    score: evalResult.score,
    reasoning: evalResult.reasoning,
    topic: evalResult.topic ?? undefined,
    primary_signal: evalResult.primary_signal ?? undefined,
    data_snapshot: data,
  });

  if (!evalResult.should_write || evalResult.score < 60) {
    return { wrote: false, score: evalResult.score, reasoning: evalResult.reasoning };
  }

  // 4. Generate article
  let article;
  try {
    article = await generateElenaArticle(data, evalResult, recentSummary);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await updateRunError(supabase, error);
    return { wrote: false, score: evalResult.score, reasoning: `Generation failed: ${error}`, error };
  }

  // 5. Publish to Sanity
  let slug: string;
  let sanityId: string;
  try {
    const result = await publishToSanity(article);
    slug = result.slug;
    sanityId = result.id;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { wrote: false, score: evalResult.score, reasoning: `Publish failed: ${error}`, error };
  }

  // 6. Save to persona_memory
  await saveToMemory(supabase, {
    content: `${article.title}\n\n${article.excerpt}`,
    metadata: {
      slug,
      title: article.title,
      topic: evalResult.topic,
      sanity_id: sanityId,
      tags: article.tags,
    },
  });

  // 7. Update run log with article reference
  await updateRunArticle(supabase, slug, sanityId);

  return { wrote: true, score: evalResult.score, reasoning: evalResult.reasoning, articleSlug: slug };
}

async function publishToSanity(article: Awaited<ReturnType<typeof generateElenaArticle>>) {
  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset: process.env.SANITY_DATASET ?? 'production',
    token: process.env.SANITY_TOKEN!,
    apiVersion: '2024-01-01',
    useCdn: false,
  });

  const slug = slugify(article.title);

  const doc = await sanity.create({
    _type: 'article',
    slug: { _type: 'slug', current: slug },
    category: article.category,
    publishedAt: new Date().toISOString(),
    tags: article.tags,
    persona: PERSONA_ID,
    authorName: PERSONA_NAME,
    authorAvatar: AVATAR_PATH,
    translations: {
      en: {
        title: article.title,
        excerpt: article.excerpt,
        body: article.body,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        telegramText: article.telegramText,
      },
    },
  });

  return { slug, id: doc._id };
}

async function getRecentArticleSummaries(supabase: ReturnType<typeof supabaseAdmin>): Promise<string> {
  const { data } = await supabase
    .from('persona_memory')
    .select('content, metadata, created_at')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'article')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!data?.length) return '';

  return data
    .map(m => {
      const meta = m.metadata as { title?: string; topic?: string };
      return `- ${meta.title ?? '(no title)'} [topic: ${meta.topic ?? 'unknown'}]`;
    })
    .join('\n');
}

async function saveToMemory(
  supabase: ReturnType<typeof supabaseAdmin>,
  entry: { content: string; metadata: Record<string, unknown> }
) {
  await supabase.from('persona_memory').insert({
    persona_id: PERSONA_ID,
    memory_type: 'article',
    content: entry.content,
    metadata: entry.metadata,
  });
}

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
    persona_id: PERSONA_ID,
    should_write: run.should_write,
    score: run.score,
    reasoning: run.reasoning,
    topic: run.topic ?? null,
    primary_signal: run.primary_signal ?? null,
    data_snapshot: run.data_snapshot,
  });
}

async function updateRunError(supabase: ReturnType<typeof supabaseAdmin>, error: string) {
  // Update most recent run for this persona today with error note
  await supabase
    .from('persona_runs')
    .update({ reasoning: `Generation error: ${error}` })
    .eq('persona_id', PERSONA_ID)
    .eq('run_date', new Date().toISOString().slice(0, 10))
    .order('created_at', { ascending: false })
    .limit(1);
}

async function updateRunArticle(
  supabase: ReturnType<typeof supabaseAdmin>,
  slug: string,
  sanityId: string
) {
  await supabase
    .from('persona_runs')
    .update({ article_slug: slug, article_id: sanityId })
    .eq('persona_id', PERSONA_ID)
    .eq('run_date', new Date().toISOString().slice(0, 10))
    .order('created_at', { ascending: false })
    .limit(1);
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    + '-' + Date.now().toString(36);
}
