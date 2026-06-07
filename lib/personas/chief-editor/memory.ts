import { supabaseAdmin } from '@/lib/supabase';
import { callClaude, parseClaudeJson } from '@/lib/personas/shared';
import type { EditorialSession, PersonaFeedback } from './evaluate';
import type { AnalystContext } from './data-collector';

const VICTOR_ID = 'victor-kane';

// ── New tables: save session + feedback + directives ─────────────────────────

export async function saveToEditorialTables(
  session: EditorialSession,
  analysts: AnalystContext[]
): Promise<void> {
  const db = supabaseAdmin();

  // 1. Upsert editorial_sessions (one per date)
  const { data: sessionRow } = await db
    .from('editorial_sessions')
    .upsert(
      {
        session_date: session.date,
        ran_at:       new Date().toISOString(),
        desk_note:    session.desk_note,
        raw_output:   session as unknown as Record<string, unknown>,
      },
      { onConflict: 'session_date' }
    )
    .select('id')
    .single();

  if (!sessionRow?.id) return;
  const sessionId = sessionRow.id as string;

  // 2. For each analyst that published — parallel across analysts
  await Promise.all(analysts.map(async (ctx) => {
    if (!ctx.todayArticle) return;
    const feedback = session.editorial_session[ctx.personaId] as PersonaFeedback | null;
    if (!feedback?.published_today) return;

    // 2a. Insert editorial_feedback
    const { data: feedbackRow } = await db
      .from('editorial_feedback')
      .insert({
        session_id:   sessionId,
        persona_id:   ctx.personaId,
        article_slug: ctx.todayArticle.slug,
        score:        feedback.score ?? 0,
        strengths:    feedback.strengths ?? [],
        priority_fix: feedback.priority_fix ?? '',
        directive:    feedback.directive ?? '',
        pattern_warn: feedback.pattern_warning ?? null,
      })
      .select('id')
      .single();

    if (!feedbackRow?.id) return;
    const feedbackId = feedbackRow.id as string;

    // 2b + 2c in parallel: resolve old directives + insert new one
    await Promise.all([
      db.from('editorial_directives')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('persona_id', ctx.personaId)
        .eq('status', 'pending'),
      feedback.directive
        ? db.from('editorial_directives').insert({
            feedback_id:  feedbackId,
            persona_id:   ctx.personaId,
            directive:    feedback.directive,
            issued_date:  session.date,
            status:       'pending',
          })
        : Promise.resolve(),
    ]);
  }));
}

// ── persona_memory: legacy path (still needed for buildContext LLM injection) ─

// Save feedback INTO each analyst's persona_memory (type='editor_feedback')
export async function saveFeedbackToAnalysts(session: EditorialSession, analysts: AnalystContext[]): Promise<void> {
  const db = supabaseAdmin();

  await Promise.all(analysts.map(async (ctx) => {
    const feedback = session.editorial_session[ctx.personaId] as PersonaFeedback | null;
    if (!feedback?.published_today || !ctx.todayArticle) return;

    const content = [
      `Score: ${feedback.score}/100`,
      `Strengths: ${feedback.strengths.join('; ')}`,
      `Priority fix: ${feedback.priority_fix}`,
      `Directive: ${feedback.directive}`,
      feedback.pattern_warning ? `Pattern warning: ${feedback.pattern_warning}` : null,
    ].filter(Boolean).join('\n');

    await Promise.all([
      db.from('persona_memory').insert({
        persona_id:  ctx.personaId,
        memory_type: 'editor_feedback',
        content,
        metadata: {
          date:            session.date,
          article_slug:    ctx.todayArticle!.slug,
          score:           feedback.score,
          strengths:       feedback.strengths,
          priority_fix:    feedback.priority_fix,
          directive:       feedback.directive,
          pattern_warning: feedback.pattern_warning ?? null,
        },
      }),
      feedback.directive
        ? saveDirectiveHistory(db, ctx.personaId, feedback.directive, session.date)
        : Promise.resolve(),
    ]);
  }));
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

  await Promise.all(
    Object.entries(session.editorial_session).map(async ([personaId, feedback]) => {
      const f = feedback as PersonaFeedback | null;
      if (!f?.published_today || f.score === null) return;

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
        persona_ref:    personaId,
        avg_score_30d:  avg,
        scores_history: history,
        trend,
        updated_at:     new Date().toISOString(),
      };

      if (existing?.id) {
        await db.from('persona_memory').update({ content: `Standard for ${personaId}: avg ${avg}, ${trend}`, metadata }).eq('id', existing.id);
      } else {
        await db.from('persona_memory').insert({ persona_id: VICTOR_ID, memory_type: 'editorial_standard', content: `Standard for ${personaId}: avg ${avg}, ${trend}`, metadata });
      }
    })
  );
}

// Check previous directives against today's article — LLM-based verification
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
    .limit(3);

  if (!openDirectives?.length) return;

  await Promise.all(
    openDirectives.map(async (row) => {
      const m = row.metadata as { directive?: string };
      if (!m.directive) return;

      const followed = await verifyDirectiveWithLLM(m.directive, todayArticle);

      if (followed !== null) {
        await db.from('persona_memory').update({
          metadata: { ...m, followed, followed_at: new Date().toISOString() },
        }).eq('id', row.id);
      }
    })
  );
}

// ── LLM directive verification ────────────────────────────────────────────────

async function verifyDirectiveWithLLM(
  directive:    string,
  article:      { title: string; body: string }
): Promise<boolean | null> {
  const prompt = `Did the writer apply this specific directive in their new article?

DIRECTIVE: "${directive}"

NEW ARTICLE:
Title: "${article.title}"
Body preview: "${article.body.slice(0, 700)}..."

Answer based only on the article text — did they follow the specific instruction?
Be strict: partial compliance counts as not followed.

Return ONLY valid JSON: { "followed": boolean, "reason": "one sentence" }`;

  try {
    const res    = await callClaude({ model: 'claude-haiku-4-5-20251001', max_tokens: 120, messages: [{ role: 'user', content: prompt }] });
    const parsed = await parseClaudeJson<{ followed: boolean; reason: string }>(res);
    return parsed.followed;
  } catch {
    return null; // best-effort, don't block
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
