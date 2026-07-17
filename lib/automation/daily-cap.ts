import type { supabaseAdmin } from '@/lib/supabase';

// Max published articles per persona per calendar day (UTC).
// Breaking news bypasses the cap but still counts toward it —
// after a breaking-heavy morning, fewer standard slots remain.
export const DAILY_ARTICLE_CAP = 3;

type Db = ReturnType<typeof supabaseAdmin>;

// Counts distinct published article slugs per persona for today.
// Source of truth: persona_runs — every publish path (RSS desk, persona
// event article, self-work) ends with a persona_runs row carrying article_slug.
export async function getPersonaArticleCountsToday(db: Db): Promise<Record<string, number>> {
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await db
    .from('persona_runs')
    .select('persona_id, article_slug')
    .eq('run_date', today)
    .not('article_slug', 'is', null);

  const slugsByPersona: Record<string, Set<string>> = {};
  for (const row of (data ?? []) as { persona_id: string; article_slug: string }[]) {
    (slugsByPersona[row.persona_id] ??= new Set()).add(row.article_slug);
  }

  return Object.fromEntries(
    Object.entries(slugsByPersona).map(([id, slugs]) => [id, slugs.size])
  );
}

export async function isPersonaAtDailyCap(db: Db, personaId: string): Promise<boolean> {
  const counts = await getPersonaArticleCountsToday(db);
  return (counts[personaId] ?? 0) >= DAILY_ARTICLE_CAP;
}
