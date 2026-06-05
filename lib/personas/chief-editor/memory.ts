import { supabaseAdmin } from '@/lib/supabase';
import type { EditorialSession, PersonaFeedback } from './evaluate';
import type { AnalystContext } from './data-collector';

const VICTOR_ID = 'victor-kane';

// Save feedback INTO each analyst's persona_memory (type='editor_feedback')
export async function saveFeedbackToAnalysts(session: EditorialSession, analysts: AnalystContext[]): Promise<void> {
  const db = supabaseAdmin();

  for (const ctx of analysts) {
    const feedback = session.editorial_session[ctx.personaId] as PersonaFeedback | null;
    if (!feedback?.published_today || !ctx.todayArticle) continue;

    const content = [
      `Score: ${feedback.score}/100`,
      `Strengths: ${feedback.strengths.join('; ')}`,
      `Priority fix: ${feedback.priority_fix}`,
      `Directive: ${feedback.directive}`,
      feedback.pattern_warning ? `Pattern warning: ${feedback.pattern_warning}` : null,
    ].filter(Boolean).join('\n');

    await db.from('persona_memory').insert({
      persona_id:  ctx.personaId,
      memory_type: 'editor_feedback',
      content,
      metadata: {
        date:            session.date,
        article_slug:    ctx.todayArticle.slug,
        score:           feedback.score,
        strengths:       feedback.strengths,
        priority_fix:    feedback.priority_fix,
        directive:       feedback.directive,
        pattern_warning: feedback.pattern_warning ?? null,
      },
    });

    // Save directive to Victor's directive_history (for tracking if it's followed)
    if (feedback.directive) {
      await saveDirectiveHistory(db, ctx.personaId, feedback.directive, session.date);
    }
  }
}

// Save daily session to Victor's own persona_memory (type='session')
export async function saveEditorSession(session: EditorialSession): Promise<void> {
  const db = supabaseAdmin();

  const scores: Record<string, number | null> = {};
  for (const [personaId, feedback] of Object.entries(session.editorial_session)) {
    scores[personaId] = (feedback as PersonaFeedback | null)?.score ?? null;
  }

  const content = `Session ${session.date}: ${session.desk_note}`;

  await db.from('persona_memory').insert({
    persona_id:  VICTOR_ID,
    memory_type: 'session',
    content,
    metadata: {
      date:              session.date,
      desk_note:         session.desk_note,
      scores,
      articles_reviewed: Object.values(session.editorial_session)
        .filter((f) => (f as PersonaFeedback | null)?.published_today).length,
    },
  });
}

// Update editorial_standard per analyst (trend tracking)
export async function updateEditorialStandards(session: EditorialSession): Promise<void> {
  const db = supabaseAdmin();

  for (const [personaId, feedback] of Object.entries(session.editorial_session)) {
    const f = feedback as PersonaFeedback | null;
    if (!f?.published_today || f.score === null) continue;

    // Load existing standard
    const { data: existing } = await db
      .from('persona_memory')
      .select('id, metadata')
      .eq('persona_id', VICTOR_ID)
      .eq('memory_type', 'editorial_standard')
      .filter('metadata->>persona_ref', 'eq', personaId)
      .single();

    const prev = (existing?.metadata as { scores_history?: number[]; avg_score_30d?: number } | null);
    const history = [...(prev?.scores_history ?? []), f.score].slice(-30);
    const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
    const prevAvg = prev?.avg_score_30d ?? avg;
    const trend: 'improving' | 'stable' | 'declining' =
      avg > prevAvg + 3 ? 'improving' : avg < prevAvg - 3 ? 'declining' : 'stable';

    const metadata = {
      persona_ref:       personaId,
      avg_score_30d:     avg,
      scores_history:    history,
      trend,
      updated_at:        new Date().toISOString(),
    };

    if (existing?.id) {
      await db.from('persona_memory').update({ content: `Standard for ${personaId}: avg ${avg}, ${trend}`, metadata }).eq('id', existing.id);
    } else {
      await db.from('persona_memory').insert({ persona_id: VICTOR_ID, memory_type: 'editorial_standard', content: `Standard for ${personaId}: avg ${avg}, ${trend}`, metadata });
    }
  }
}

// Check previous directives against today's article (mark as followed/not followed)
export async function verifyPreviousDirectives(
  personaId: string,
  todayArticle: { title: string; body: string } | null
): Promise<void> {
  if (!todayArticle) return;
  const db = supabaseAdmin();

  const { data: openDirectives } = await db
    .from('persona_memory')
    .select('id, metadata')
    .eq('persona_id', VICTOR_ID)
    .eq('memory_type', 'directive_history')
    .filter('metadata->>persona_ref', 'eq', personaId)
    .filter('metadata->>followed', 'is', null)
    .limit(5);

  if (!openDirectives?.length) return;

  for (const row of openDirectives) {
    const m = row.metadata as { directive?: string };
    const directive = (m.directive ?? '').toLowerCase();
    const articleText = (todayArticle.title + ' ' + todayArticle.body).toLowerCase();

    // Simple heuristic: if directive mentions "question" and article doesn't end with "?", it was followed
    let followed: boolean | null = null;
    if (directive.includes('question') || directive.includes('close with')) {
      followed = !articleText.trimEnd().endsWith('?');
    } else if (directive.includes('vary') || directive.includes('different opening')) {
      followed = true; // assume followed if they published at all (can't reliably check)
    }

    if (followed !== null) {
      await db.from('persona_memory').update({
        metadata: { ...m, followed, followed_at: new Date().toISOString() },
      }).eq('id', row.id);
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function saveDirectiveHistory(
  db: ReturnType<typeof supabaseAdmin>,
  personaId: string,
  directive: string,
  date: string
) {
  await db.from('persona_memory').insert({
    persona_id:  VICTOR_ID,
    memory_type: 'directive_history',
    content:     `Directive to ${personaId}: ${directive}`,
    metadata: {
      persona_ref: personaId,
      directive,
      given_at:    date,
      followed:    null,
      followed_at: null,
    },
  });
}

// Load Victor's own context for the evaluate prompt
export async function loadEditorMemory(): Promise<string> {
  const db = supabaseAdmin();
  const [{ data: sessions }, { data: standards }] = await Promise.all([
    db.from('persona_memory').select('content, metadata').eq('persona_id', VICTOR_ID).eq('memory_type', 'session').order('created_at', { ascending: false }).limit(3),
    db.from('persona_memory').select('content, metadata').eq('persona_id', VICTOR_ID).eq('memory_type', 'editorial_standard'),
  ]);

  const parts: string[] = [];

  if (standards?.length) {
    parts.push('Editorial standards (current):');
    standards.forEach((s) => {
      const m = s.metadata as { persona_ref?: string; avg_score_30d?: number; trend?: string };
      parts.push(`  ${m.persona_ref}: avg ${m.avg_score_30d}/100, ${m.trend}`);
    });
  }

  if (sessions?.length) {
    parts.push('Recent desk notes:');
    sessions.forEach((s) => parts.push(`  ${s.content}`));
  }

  return parts.join('\n');
}
