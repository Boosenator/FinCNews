import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const PERSONAS = [
  { id: 'elena-voss',  name: 'Elena Voss',  color: '#a78bfa' },  // violet
  { id: 'marcus-webb', name: 'Marcus Webb', color: '#2dd4bf' },  // teal
  { id: 'leo-cruz',    name: 'Leo Cruz',    color: '#fb923c' },  // coral
];

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '14', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('editorial_sessions')
    .select('session_date, editorial_feedback(persona_id, score, article_slug)')
    .gte('session_date', since)
    .order('session_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Build date range (every day in window)
  const dates: string[] = [];
  const d = new Date(since);
  const end = new Date();
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }

  // Index sessions by date
  const sessionByDate = new Map<string, { persona_id: string; score: number; article_slug: string | null }[]>();
  for (const s of (data ?? [])) {
    sessionByDate.set(
      s.session_date,
      (s.editorial_feedback as { persona_id: string; score: number; article_slug: string | null }[]) ?? []
    );
  }

  // Build persona series
  const personas = PERSONAS.map((p) => {
    const scores: (number | null)[] = [];
    const articleSlugs: (string | null)[] = [];
    let scoreSum = 0, scoreCount = 0;

    for (const date of dates) {
      const dayFeedback = sessionByDate.get(date);
      const match = dayFeedback?.find((f) => f.persona_id === p.id);
      if (match) {
        scores.push(match.score);
        articleSlugs.push(match.article_slug ?? null);
        scoreSum += match.score;
        scoreCount++;
      } else {
        scores.push(null);
        articleSlugs.push(null);
      }
    }

    return {
      id:           p.id,
      name:         p.name,
      color:        p.color,
      scores,
      article_slugs: articleSlugs,
      avg:          scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
    };
  });

  return NextResponse.json({ dates, personas });
}
