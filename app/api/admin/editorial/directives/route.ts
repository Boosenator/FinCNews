import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data, error } = await db
    .from('editorial_directives')
    .select('id, persona_id, directive, issued_date, target_article_slug, status, resolved_at, created_at')
    .order('issued_date', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ directives: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, status } = await req.json() as { id: string; status: 'pending' | 'resolved' | 'missed' };

  const db = supabaseAdmin();
  const { error } = await db
    .from('editorial_directives')
    .update({ status, resolved_at: status !== 'pending' ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
