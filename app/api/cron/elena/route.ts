import { NextRequest, NextResponse } from 'next/server';
import { runElenaVoss } from '@/lib/personas/elena-voss';
import { verifyOpenForecasts } from '@/lib/personas/elena-voss/forecasts';

export const maxDuration = 60;

function isAuthed(req: NextRequest) {
  const auth = req.headers.get('authorization');
  return process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function handle(req: NextRequest) {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [result, forecasts] = await Promise.all([
      runElenaVoss(),
      verifyOpenForecasts(),
    ]);
    return NextResponse.json({ ok: true, ...result, forecasts_verified: forecasts });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
