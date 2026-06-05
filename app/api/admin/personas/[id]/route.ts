import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// Elena Voss
import { pullElenaData } from '@/lib/personas/elena-voss/data-pull';
import { shouldWrite as elenaEval } from '@/lib/personas/elena-voss/should-write';
import { generateElenaArticle } from '@/lib/personas/elena-voss/generate';
import { runElenaVoss, getElenaContext } from '@/lib/personas/elena-voss';
import { decideSelfWork as elenaDecideSelf, executeSelfWork as elenaExecSelf } from '@/lib/personas/elena-voss/self-work';

// Leo Cruz
import { pullLeoData } from '@/lib/personas/leo-cruz/data-pull';
import { detectSignals } from '@/lib/personas/leo-cruz/signals';
import { loadNarrativeHistory } from '@/lib/personas/leo-cruz/narratives';
import { shouldWrite as leoEval } from '@/lib/personas/leo-cruz/should-write';
import { generateLeoArticle } from '@/lib/personas/leo-cruz/generate';
import { runLeoCruz, getLeoContext } from '@/lib/personas/leo-cruz';
import { decideSelfWork as leoDecideSelf, executeSelfWork as leoExecSelf } from '@/lib/personas/leo-cruz/self-work';

export const maxDuration = 60;

type Action = 'data-pull' | 'should-write' | 'generate' | 'run' | 'self-work' | 'show-context' | 'toggle-active' | 'recent-runs';

const KNOWN_PERSONAS = ['elena-voss', 'leo-cruz'];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!KNOWN_PERSONAS.includes(params.id)) return NextResponse.json({ error: 'Unknown persona' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: Action; topic?: string };
  const { action, topic } = body;

  try {
    // ── Shared actions ──────────────────────────────────────────────────────
    if (action === 'toggle-active') {
      const db = supabaseAdmin();
      const { data: persona } = await db.from('personas').select('is_active').eq('id', params.id).single();
      const newState = !(persona as { is_active: boolean } | null)?.is_active;
      await db.from('personas').update({ is_active: newState, updated_at: new Date().toISOString() }).eq('id', params.id);
      return NextResponse.json({ ok: true, is_active: newState });
    }

    if (action === 'recent-runs') {
      const db = supabaseAdmin();
      const { data } = await db.from('persona_runs').select('*').eq('persona_id', params.id).order('created_at', { ascending: false }).limit(10);
      return NextResponse.json({ ok: true, runs: data ?? [] });
    }

    // ── Elena Voss ──────────────────────────────────────────────────────────
    if (params.id === 'elena-voss') {
      if (action === 'data-pull') {
        const data = await pullElenaData();
        return NextResponse.json({ ok: true, data });
      }
      if (action === 'should-write') {
        const data = await pullElenaData();
        const summary = await getRecentSummary(params.id);
        const result = await elenaEval(data, summary);
        return NextResponse.json({ ok: true, result, data_snapshot: data });
      }
      if (action === 'generate') {
        const data = await pullElenaData();
        const summary = await getRecentSummary(params.id);
        const evalResult = await elenaEval(data, summary);
        if (!evalResult.should_write) return NextResponse.json({ ok: true, skipped: true, score: evalResult.score, reasoning: evalResult.reasoning });
        const article = await generateElenaArticle(data, evalResult, summary);
        return NextResponse.json({ ok: true, dry_run: true, eval: evalResult, article });
      }
      if (action === 'run') {
        const result = await runElenaVoss();
        return NextResponse.json({ ok: true, ...result });
      }
      if (action === 'self-work') {
        const data = await pullElenaData();
        const summary = await getRecentSummary(params.id);
        const task = await elenaDecideSelf();
        if (!task) return NextResponse.json({ ok: true, skipped: true, reason: 'No self-work needed today' });
        const result = await elenaExecSelf(task, data, summary);
        return NextResponse.json({ ok: true, task, ...result });
      }
      if (action === 'show-context') {
        const layers = await getElenaContext(topic);
        return NextResponse.json({ ok: true, layers });
      }
    }

    // ── Leo Cruz ────────────────────────────────────────────────────────────
    if (params.id === 'leo-cruz') {
      if (action === 'data-pull') {
        const data = await pullLeoData();
        const narratives = await loadNarrativeHistory();
        const signals = detectSignals(data, narratives);
        return NextResponse.json({ ok: true, data, signals });
      }
      if (action === 'should-write') {
        const data = await pullLeoData();
        const narratives = await loadNarrativeHistory();
        const signals = detectSignals(data, narratives);
        const summary = await getRecentSummary(params.id);
        const result = await leoEval(signals, narratives, data, summary);
        return NextResponse.json({ ok: true, result, signals, data_snapshot: data });
      }
      if (action === 'generate') {
        const data = await pullLeoData();
        const narratives = await loadNarrativeHistory();
        const signals = detectSignals(data, narratives);
        const summary = await getRecentSummary(params.id);
        const evalResult = await leoEval(signals, narratives, data, summary);
        if (!evalResult.should_write) return NextResponse.json({ ok: true, skipped: true, score: evalResult.score, reasoning: evalResult.reasoning });
        const article = await generateLeoArticle(data, signals, evalResult, narratives, summary);
        return NextResponse.json({ ok: true, dry_run: true, eval: evalResult, article });
      }
      if (action === 'run') {
        const result = await runLeoCruz();
        return NextResponse.json({ ok: true, ...result });
      }
      if (action === 'self-work') {
        const data = await pullLeoData();
        const narratives = await loadNarrativeHistory();
        const summary = await getRecentSummary(params.id);
        const task = await leoDecideSelf();
        const result = await leoExecSelf(task, data, narratives, summary);
        return NextResponse.json({ ok: true, task, ...result });
      }
      if (action === 'show-context') {
        const layers = await getLeoContext(topic);
        return NextResponse.json({ ok: true, layers });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = supabaseAdmin();
  const { data: persona } = await db.from('personas').select('*').eq('id', params.id).single();
  const { data: runs } = await db.from('persona_runs').select('*').eq('persona_id', params.id).order('created_at', { ascending: false }).limit(5);
  return NextResponse.json({ persona, recent_runs: runs ?? [] });
}

async function getRecentSummary(personaId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data } = await db.from('persona_memory').select('content, metadata').eq('persona_id', personaId).eq('memory_type', 'article').order('created_at', { ascending: false }).limit(5);
  if (!data?.length) return '';
  return data.map((m) => { const meta = m.metadata as { title?: string; topic?: string }; return `- ${meta.title ?? '(no title)'} [${meta.topic ?? 'unknown'}]`; }).join('\n');
}
