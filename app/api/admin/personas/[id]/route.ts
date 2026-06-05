import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { pullElenaData } from '@/lib/personas/elena-voss/data-pull';
import { shouldWrite } from '@/lib/personas/elena-voss/should-write';
import { generateElenaArticle } from '@/lib/personas/elena-voss/generate';
import { runElenaVoss, getElenaContext } from '@/lib/personas/elena-voss';
import { decideSelfWork, executeSelfWork } from '@/lib/personas/elena-voss/self-work';

export const maxDuration = 60;

type Action = 'data-pull' | 'should-write' | 'generate' | 'run' | 'self-work' | 'show-context' | 'toggle-active' | 'recent-runs';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (params.id !== 'elena-voss') {
    return NextResponse.json({ error: 'Unknown persona' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { action?: Action; topic?: string };
  const action = body.action;

  try {
    switch (action) {
      case 'data-pull': {
        const data = await pullElenaData();
        return NextResponse.json({ ok: true, data });
      }

      case 'should-write': {
        const data = await pullElenaData();
        const recentSummary = await getRecentSummary();
        const result = await shouldWrite(data, recentSummary);
        return NextResponse.json({ ok: true, result, data_snapshot: data });
      }

      case 'generate': {
        // Dry run — generates article but does NOT publish to Sanity
        const data = await pullElenaData();
        const recentSummary = await getRecentSummary();
        const evalResult = await shouldWrite(data, recentSummary);

        if (!evalResult.should_write) {
          return NextResponse.json({
            ok: true,
            skipped: true,
            score: evalResult.score,
            reasoning: evalResult.reasoning,
          });
        }

        const article = await generateElenaArticle(data, evalResult, recentSummary);
        return NextResponse.json({ ok: true, dry_run: true, eval: evalResult, article });
      }

      case 'run': {
        const result = await runElenaVoss();
        return NextResponse.json({ ok: true, ...result });
      }

      case 'self-work': {
        const data = await pullElenaData();
        const recentSummary = await getRecentSummary();
        const task = await decideSelfWork();
        if (!task) {
          return NextResponse.json({ ok: true, skipped: true, reason: 'No self-work needed today' });
        }
        const result = await executeSelfWork(task, data, recentSummary);
        return NextResponse.json({ ok: true, task, ...result });
      }

      case 'show-context': {
        const layers = await getElenaContext(body.topic);
        return NextResponse.json({ ok: true, layers });
      }

      case 'toggle-active': {
        const db = supabaseAdmin();
        const { data: persona } = await db
          .from('personas')
          .select('is_active')
          .eq('id', params.id)
          .single();

        const newState = !(persona as { is_active: boolean } | null)?.is_active;
        await db.from('personas').update({ is_active: newState, updated_at: new Date().toISOString() }).eq('id', params.id);
        return NextResponse.json({ ok: true, is_active: newState });
      }

      case 'recent-runs': {
        const db = supabaseAdmin();
        const { data } = await db
          .from('persona_runs')
          .select('*')
          .eq('persona_id', params.id)
          .order('created_at', { ascending: false })
          .limit(10);
        return NextResponse.json({ ok: true, runs: data ?? [] });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = supabaseAdmin();
  const { data: persona } = await db.from('personas').select('*').eq('id', params.id).single();
  const { data: runs } = await db
    .from('persona_runs')
    .select('*')
    .eq('persona_id', params.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({ persona, recent_runs: runs ?? [] });
}

async function getRecentSummary(): Promise<string> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('persona_memory')
    .select('content, metadata')
    .eq('persona_id', 'elena-voss')
    .eq('memory_type', 'article')
    .order('created_at', { ascending: false })
    .limit(5);

  if (!data?.length) return '';
  return data
    .map(m => {
      const meta = m.metadata as { title?: string; topic?: string };
      return `- ${meta.title ?? '(no title)'} [topic: ${meta.topic ?? 'unknown'}]`;
    })
    .join('\n');
}
