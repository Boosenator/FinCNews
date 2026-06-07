import { supabaseAdmin } from '@/lib/supabase';
import { embedText } from '@/lib/personas/embeddings';

export type CoverageLogEntry = {
  title:           string;
  excerpt:         string;
  slug:            string;
  persona_id:      string | null;
  generation_type: 'rss' | 'proactive';
  source_url:      string | null;
};

export async function insertCoverageLog(entry: CoverageLogEntry): Promise<void> {
  const db = supabaseAdmin();

  // Try to generate embedding (requires OPENAI_API_KEY)
  const embedding = await embedText(`${entry.title} ${entry.excerpt}`);

  await db.from('coverage_log').insert({
    title:           entry.title,
    excerpt:         entry.excerpt,
    slug:            entry.slug,
    persona_id:      entry.persona_id,
    generation_type: entry.generation_type,
    source_url:      entry.source_url,
    embedding:       embedding ?? undefined,
    published_at:    new Date().toISOString(),
  });
}

export type RecentCoverageRow = {
  title:      string;
  slug:       string;
  persona_id: string | null;
};

// For triage: recent titles to detect continuations
export async function getRecentCoverageForTriage(limitDays = 14): Promise<RecentCoverageRow[]> {
  const db     = supabaseAdmin();
  const cutoff = new Date(Date.now() - limitDays * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await db
    .from('coverage_log')
    .select('title, slug, persona_id')
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(50);

  return (data ?? []) as RecentCoverageRow[];
}
