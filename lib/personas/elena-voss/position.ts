import { supabaseAdmin } from '@/lib/supabase';
import { callClaude, parseClaudeJson } from '@/lib/personas/shared';

const PERSONA_ID = 'elena-voss';

export type MacroStance = 'bearish' | 'watchful-cautious' | 'neutral' | 'selective-bullish';

export interface ElenaPosition {
  stance:        MacroStance;
  on:            string;         // "BTC" | "crypto" | "risk-assets"
  regime:        string;         // brief: "Fed paused, growth slowing"
  conviction:    string;         // key point: "yield curve = term premium not growth"
  changed_from:  MacroStance | null;
  updated_at:    string;
}

// Called after every article publication — extracts and saves Elena's current position
export async function extractAndSavePosition(
  title: string,
  excerpt: string,
  bodyPreview: string   // first 800 chars is enough
): Promise<void> {
  const previous = await getCurrentPosition();

  const prompt = `You are extracting Elena Voss's current macro position from her latest article.

PREVIOUS POSITION: ${previous ? `${previous.stance} on ${previous.on} (${previous.conviction})` : 'none — this is her first article'}

ARTICLE TITLE: ${title}
ARTICLE EXCERPT: ${excerpt}
ARTICLE BODY (preview): ${bodyPreview.slice(0, 800)}

Extract her current analytical position on crypto/BTC markets.

Return ONLY valid JSON:
{
  "stance": "bearish" | "watchful-cautious" | "neutral" | "selective-bullish",
  "on": "BTC" or "crypto" or "risk-assets",
  "regime": "one phrase describing the current macro regime she sees (e.g. 'Fed paused, growth slowing')",
  "conviction": "the single analytical point driving her view (one sentence max)",
  "changed_from": "previous stance if it changed, or null if same"
}`;

  let position: ElenaPosition;
  try {
    const res = await callClaude({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const parsed = await parseClaudeJson<Omit<ElenaPosition, 'updated_at'>>(res);
    position = { ...parsed, updated_at: new Date().toISOString() };
  } catch {
    return; // position extraction is best-effort, never block article publishing
  }

  const db = supabaseAdmin();

  // Upsert: one active position record per persona
  const { data: existing } = await db
    .from('persona_memory')
    .select('id')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'position')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing?.id) {
    await db
      .from('persona_memory')
      .update({ content: positionToText(position), metadata: position as unknown as Record<string, unknown> })
      .eq('id', existing.id);
  } else {
    await db.from('persona_memory').insert({
      persona_id:  PERSONA_ID,
      memory_type: 'position',
      content:     positionToText(position),
      metadata:    position as unknown as Record<string, unknown>,
    });
  }
}

// Returns current position for use in prompts / context
export async function getCurrentPosition(): Promise<ElenaPosition | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from('persona_memory')
    .select('metadata')
    .eq('persona_id', PERSONA_ID)
    .eq('memory_type', 'position')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data ? (data.metadata as unknown as ElenaPosition) : null;
}

function positionToText(p: ElenaPosition): string {
  return `Elena's position: ${p.stance} on ${p.on}. Regime: ${p.regime}. Conviction: ${p.conviction}`;
}
