import { supabaseAdmin } from '@/lib/supabase';

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
const EMBED_MODEL      = 'text-embedding-3-small'; // 1536 dims — matches schema

// Returns null if OPENAI_API_KEY is not configured (graceful skip)
export async function embedText(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const res = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 8000) }),
  });

  if (!res.ok) {
    console.warn(`[embeddings] OpenAI error ${res.status}: ${await res.text()}`);
    return null;
  }

  const data = await res.json() as { data: { embedding: number[] }[] };
  return data.data[0]?.embedding ?? null;
}

// Embed and save to an existing persona_memory row (fire-and-forget friendly)
export async function saveEmbedding(memoryId: string, text: string): Promise<void> {
  const vector = await embedText(text);
  if (!vector) return;

  const db = supabaseAdmin();
  await db
    .from('persona_memory')
    .update({ embedding: JSON.stringify(vector) })
    .eq('id', memoryId);
}

// Semantic search: find past articles similar to a topic string
// Falls back to empty array if embeddings not available
export async function searchSimilarMemories(
  personaId: string,
  topic: string,
  limit = 4
): Promise<Array<{ content: string; metadata: Record<string, unknown>; similarity: number }>> {
  const vector = await embedText(topic);
  if (!vector) return [];

  const db = supabaseAdmin();
  const { data, error } = await db.rpc('match_persona_memories', {
    p_persona_id:    personaId,
    query_embedding: JSON.stringify(vector),
    match_threshold: 0.65,
    match_count:     limit,
  });

  if (error) {
    console.warn('[embeddings] similarity search error:', error.message);
    return [];
  }

  return (data ?? []).map((row: {
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }) => ({
    content:    row.content,
    metadata:   row.metadata,
    similarity: row.similarity,
  }));
}
