import { createClient } from '@sanity/client';

export const PERSONA_AVATAR: Record<string, string> = {
  'elena-voss':  '/authors/elena-voss.png',
  'marcus-webb': '/authors/marcus-webb.png',
  'leo-cruz':    '/authors/leo-cruz.png',
};

export const PERSONA_NAME: Record<string, string> = {
  'elena-voss':  'Elena Voss',
  'marcus-webb': 'Marcus Webb',
  'leo-cruz':    'Leo Cruz',
};

export interface PublishableArticle {
  title: string;
  excerpt: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  tags: string[];
  category: string;
  telegramText: string;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) + '-' + Date.now().toString(36);
}

export async function publishArticleToSanity(
  article: PublishableArticle,
  personaId: string
): Promise<{ slug: string; id: string }> {
  const sanity = createClient({
    projectId: process.env.SANITY_PROJECT_ID!,
    dataset:   process.env.SANITY_DATASET ?? 'production',
    token:     process.env.SANITY_TOKEN!,
    apiVersion: '2024-01-01',
    useCdn: false,
  });

  const slug = slugify(article.title);

  const doc = await sanity.create({
    _type: 'article',
    slug: { _type: 'slug', current: slug },
    category:     article.category,
    publishedAt:  new Date().toISOString(),
    tags:         article.tags,
    persona:      personaId,
    authorName:   PERSONA_NAME[personaId] ?? personaId,
    authorAvatar: PERSONA_AVATAR[personaId] ?? null,
    translations: {
      en: {
        title:           article.title,
        excerpt:         article.excerpt,
        body:            article.body,
        metaTitle:       article.metaTitle,
        metaDescription: article.metaDescription,
        telegramText:    article.telegramText,
      },
    },
  });

  return { slug, id: doc._id };
}

export function callClaude(body: {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: string; content: string }[];
}): Promise<Response> {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
}

export async function parseClaudeJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { content: { text: string }[] };
  const text = json.content[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude returned no JSON');
  return JSON.parse(match[0]) as T;
}
