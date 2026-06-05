import { NextRequest, NextResponse } from 'next/server';
import { runChiefEditor } from '@/lib/personas/chief-editor';

export const maxDuration = 60;

function isAuthed(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function handle(req: NextRequest) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await runChiefEditor();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const GET  = handle;
export const POST = handle;
