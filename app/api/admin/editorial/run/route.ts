import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { runChiefEditor } from '@/lib/personas/chief-editor';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await runChiefEditor();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
