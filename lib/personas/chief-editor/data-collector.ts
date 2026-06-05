import { createClient } from '@sanity/client';
import { supabaseAdmin } from '@/lib/supabase';

const ANALYSTS = ['elena-voss', 'marcus-webb', 'leo-cruz'] as const;
type AnalystId = (typeof ANALYSTS)[number];

export interface ArticleSummary {
  slug:        string;
  title:       string;
  excerpt:     string;
  body:        string;    // first 600 chars for pattern analysis
  category:    string;
  publishedAt: string;
  persona:     string;
}

export interface AnalystContext {
  personaId:       AnalystId;
  todayArticle:    ArticleSummary | null;
  last5Articles:   ArticleSummary[];
  openForecasts:   string[];   // content strings
  recentFeedback:  string[];   // last 3 editor_feedback content strings
  directives:      string[];   // last 3 directives from directive_history
}

export interface CollectedData {
  date:        string;
  analysts:    AnalystContext[];
  anyPublished: boolean;
}

// ── Sanity ────────────────────────────────────────────────────────────────────

function getSanity() {
  return createClient({
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset:   process.env.SANITY_DATASET ?? 'production',
    token:     process.env.SANITY_TOKEN!,
    apiVersion: '2024-01-01',
    useCdn: false,
  });
}

async function fetchArticles(personaId: string, since: string, limit: number): Promise<ArticleSummary[]> {
  const sanity = getSanity();
  const results = await sanity.fetch<Array<{
    slug:        { current: string };
    translations: { en: { title: string; excerpt: string; body?: Array<{ children?: Array<{ text: string }> }> } };
    category:    string;
    publishedAt: string;
  }>>(
    `*[_type == "article" && persona == $persona && publishedAt >= $since]
     | order(publishedAt desc)[0...$limit] {
       "slug": slug.current,
       translations,
       category,
       publishedAt
     }`,
    { persona: personaId, since, limit }
  );

  return results.map((r) => {
    const en   = r.translations?.en ?? {};
    const body = (en.body ?? [])
      .flatMap((b) => (b.children ?? []).map((c) => c.text))
      .join(' ')
      .slice(0, 600);
    return {
      slug:        r.slug.current,
      title:       en.title ?? '',
      excerpt:     en.excerpt ?? '',
      body,
      category:    r.category,
      publishedAt: r.publishedAt,
      persona:     personaId,
    };
  });
}

// ── Supabase ──────────────────────────────────────────────────────────────────

async function fetchOpenForecasts(personaId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('persona_memory')
    .select('content')
    .eq('persona_id', personaId)
    .eq('memory_type', 'forecast')
    .filter('metadata->>status', 'eq', 'open')
    .order('created_at', { ascending: false })
    .limit(5);
  return (data ?? []).map((r) => r.content as string);
}

async function fetchRecentFeedback(personaId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('persona_memory')
    .select('content, created_at')
    .eq('persona_id', personaId)
    .eq('memory_type', 'editor_feedback')
    .order('created_at', { ascending: false })
    .limit(3);
  return (data ?? []).map((r) => r.content as string);
}

async function fetchRecentDirectives(personaId: string): Promise<string[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('persona_memory')
    .select('content, metadata')
    .eq('persona_id', 'victor-kane')
    .eq('memory_type', 'directive_history')
    .filter('metadata->>persona_ref', 'eq', personaId)
    .order('created_at', { ascending: false })
    .limit(3);
  return (data ?? []).map((r) => {
    const m = r.metadata as { directive?: string; given_at?: string; followed?: boolean | null };
    const followedStr = m.followed === true ? '(followed ✓)' : m.followed === false ? '(not followed ✗)' : '(pending)';
    return `${m.directive} ${followedStr}`;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function collectData(): Promise<CollectedData> {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const todayStart   = `${today}T00:00:00.000Z`;

  const analysts: AnalystContext[] = await Promise.all(
    ANALYSTS.map(async (personaId): Promise<AnalystContext> => {
      const [todayArticles, last5Articles, openForecasts, recentFeedback, directives] =
        await Promise.all([
          fetchArticles(personaId, todayStart, 3),
          fetchArticles(personaId, sevenDaysAgo, 5),
          fetchOpenForecasts(personaId),
          fetchRecentFeedback(personaId),
          fetchRecentDirectives(personaId),
        ]);

      return {
        personaId,
        todayArticle:   todayArticles[0] ?? null,
        last5Articles,
        openForecasts,
        recentFeedback,
        directives,
      };
    })
  );

  return {
    date:         today,
    analysts,
    anyPublished: analysts.some((a) => a.todayArticle !== null),
  };
}
