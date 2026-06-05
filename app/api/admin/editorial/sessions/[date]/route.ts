import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest, { params }: { params: { date: string } }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('editorial_sessions')
    .select(`
      id, session_date, ran_at, desk_note, raw_output,
      editorial_feedback ( id, persona_id, article_slug, score, strengths, priority_fix, directive, pattern_warn )
    `)
    .eq('session_date', params.date)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ session: data });
}
