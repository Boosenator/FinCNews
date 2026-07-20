import { supabaseAdmin } from '@/lib/supabase';
import { collectData } from './data-collector';
import { detectPatterns } from './patterns';
import {
  detectOverlap,
  evaluateAnalyst,
  synthesizeDeskNote,
  type PersonaFeedback,
} from './evaluate';
import {
  saveFeedbackToAnalysts,
  saveEditorSession,
  updateEditorialStandards,
  verifyPreviousDirectives,
  saveToEditorialTables,
  loadEditorMemory,
} from './memory';

const PERSONA_ID = 'victor-kane';

export interface ChiefEditorResult {
  ran:               boolean;
  reason:            string;
  date?:             string;
  analystsReviewed?: string[];
  scores?:           Record<string, number | null>;
  deskNote?:         string;
  overlapDetected?:  boolean;
  error?:            string;
}

export async function runChiefEditor(): Promise<ChiefEditorResult> {
  const db = supabaseAdmin();

  // 0. is_active check
  const { data: persona } = await db.from('personas').select('is_active').eq('id', PERSONA_ID).single();
  if (!(persona as { is_active: boolean } | null)?.is_active) {
    return { ran: false, reason: 'Victor Kane is inactive' };
  }

  // 1. Collect data (no LLM)
  let collected;
  try {
    collected = await collectData();
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ran: false, reason: `Data collection failed: ${error}`, error };
  }

  // 2. Quiet desk
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

  const publishedAnalysts = collected.analysts.filter((a) => a.todayArticle !== null);

  // 3. Verify previous directives (no LLM)
  await Promise.all(
    publishedAnalysts.map((ctx) => verifyPreviousDirectives(ctx.personaId, ctx.todayArticle))
  );

  // 4. Detect semantic overlap between articles (embeddings, no LLM)
  const overlap = await detectOverlap(publishedAnalysts);

  // 5. Load Victor's own memory (for each analyst prompt)
  const editorMemory = await loadEditorMemory();

  // 6. Evaluate each published analyst in PARALLEL (sonnet × N)
  const scorecards: Record<string, PersonaFeedback | null> = {};

  // Pre-detect patterns for all analysts (no LLM)
  const allPatterns = publishedAnalysts.map((ctx) => ({
    personaId: ctx.personaId,
    alerts:    detectPatterns(ctx.personaId, ctx.todayArticle!, ctx.last5Articles),
  }));

  // Parallel evaluation
  await Promise.all(
    collected.analysts.map(async (ctx) => {
      if (!ctx.todayArticle) {
        scorecards[ctx.personaId] = null;
        return;
      }
      const patterns = allPatterns.find((p) => p.personaId === ctx.personaId)?.alerts ?? [];
      scorecards[ctx.personaId] = await evaluateAnalyst(ctx, overlap, editorMemory, patterns);
    })
  );

  // 7. Synthesize desk note (haiku — single call, structured input)
  let session;
  try {
    session = await synthesizeDeskNote(scorecards, overlap, collected.date);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { ran: false, reason: `Synthesis failed: ${error}`, error };
  }

  // 8. Save to editorial tables + persona_memory (both paths)
  await saveToEditorialTables(session, collected.analysts);
  await saveFeedbackToAnalysts(session, collected.analysts);

  // 9. Save Victor's own session + update standards
  await Promise.all([
    saveEditorSession(session),
    updateEditorialStandards(session),
  ]);

  // 10. Log run
  const reviewed: string[] = [];
  const scores: Record<string, number | null> = {};
  for (const [id, f] of Object.entries(session.editorial_session)) {
    const fb = f as PersonaFeedback | null;
    scores[id] = fb?.score ?? null;
    if (fb?.published_today) reviewed.push(id);
  }

  await db.from('persona_runs').insert({
    persona_id:    PERSONA_ID,
    should_write:  true,
    score:         100,
    reasoning:     `Reviewed ${reviewed.length} article(s) (${reviewed.join(', ')}). ${session.desk_note}`,
    topic:         reviewed.join(', '),
    data_snapshot: { date: collected.date, scores, overlap: overlap.pairs.length > 0 },
  });

  return {
    ran:              true,
    reason:           `Reviewed ${reviewed.length} article(s)`,
    date:             collected.date,
    analystsReviewed: reviewed,
    scores,
    deskNote:         session.desk_note,
    overlapDetected:  overlap.pairs.length > 0,
  };
}
