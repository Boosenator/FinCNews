import { supabaseAdmin } from '@/lib/supabase';
import { collectData } from './data-collector';
import { detectPatterns } from './patterns';
import { evaluate } from './evaluate';
import { saveFeedbackToAnalysts, saveEditorSession, updateEditorialStandards, verifyPreviousDirectives, saveToEditorialTables } from './memory';

const PERSONA_ID = 'victor-kane';

export interface ChiefEditorResult {
  ran:               boolean;
  reason:            string;
  date?:             string;
  analystsReviewed?: string[];
  scores?:           Record<string, number | null>;
  deskNote?:         string;
  error?:            string;
}

export async function runChiefEditor(): Promise<ChiefEditorResult> {
  const db = supabaseAdmin();

  // is_active check
  const { data: persona } = await db.from('personas').select('is_active').eq('id', PERSONA_ID).single();
  if (!(persona as { is_active: boolean } | null)?.is_active) {
    return { ran: false, reason: 'Victor Kane is inactive' };
  }

  // 1. Collect all data
  let collected;
  try {
    collected = await collectData();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ran: false, reason: `Data collection failed: ${error}`, error };
  }

  // 2. Quiet desk — nobody published today
  if (!collected.anyPublished) {
    await db.from('persona_runs').insert({
      persona_id:   PERSONA_ID,
      should_write: false,
      score:        0,
      reasoning:    'Quiet desk — no analysts published today',
      data_snapshot: { date: collected.date },
    });
    return { ran: false, reason: 'Quiet desk — no articles to review' };
  }

  // 3. Verify previous directives (before evaluate so Victor has updated info)
  await Promise.all(
    collected.analysts.map((ctx) =>
      verifyPreviousDirectives(ctx.personaId, ctx.todayArticle)
    )
  );

  // 4. Detect patterns
  const allAlerts = collected.analysts
    .filter((ctx) => ctx.todayArticle)
    .flatMap((ctx) => detectPatterns(ctx.personaId, ctx.todayArticle!, ctx.last5Articles));

  // 5. Evaluate
  let session;
  try {
    session = await evaluate(collected, allAlerts);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ran: false, reason: `Evaluation failed: ${error}`, error };
  }

  // 6a. Save to dedicated editorial tables (for admin UI queries)
  await saveToEditorialTables(session, collected.analysts);

  // 6b. Save feedback to each analyst's persona_memory (for LLM buildContext injection)
  await saveFeedbackToAnalysts(session, collected.analysts);

  // 7. Save Victor's own session + update standards
  await Promise.all([
    saveEditorSession(session),
    updateEditorialStandards(session),
  ]);

  // 8. Log run
  const scores: Record<string, number | null> = {};
  const reviewed: string[] = [];
  for (const [id, f] of Object.entries(session.editorial_session)) {
    const score = (f as { score?: number | null } | null)?.score ?? null;
    scores[id] = score;
    if ((f as { published_today?: boolean } | null)?.published_today) reviewed.push(id);
  }

  await db.from('persona_runs').insert({
    persona_id:   PERSONA_ID,
    should_write: true,
    score:        100, // Victor always "succeeds" if he ran
    reasoning:    `Reviewed ${reviewed.length} article(s). ${session.desk_note}`,
    topic:        reviewed.join(', '),
    data_snapshot: { date: collected.date, scores },
  });

  return {
    ran:               true,
    reason:            `Reviewed ${reviewed.length} article(s)`,
    date:              collected.date,
    analystsReviewed:  reviewed,
    scores,
    deskNote:          session.desk_note,
  };
}
