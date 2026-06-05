import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('editorial_sessions')
    .select(`
      id, session_date, ran_at, desk_note,
      editorial_feedback ( persona_id, article_slug, score, strengths, priority_fix, directive, pattern_warn )
    `)
    .order('session_date', { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
