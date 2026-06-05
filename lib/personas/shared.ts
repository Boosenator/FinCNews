import { createClient } from '@sanity/client';
import type { PortableTextBlock } from '@/lib/sanity';

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

// Converts markdown string to Sanity PortableText blocks.
// Handles: ## h2, ### h3, **bold**, *italic*, plain paragraphs.
export function markdownToPortableText(markdown: string): PortableTextBlock[] {
  return markdown
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map((paragraph, i) => {
      const h2 = paragraph.match(/^##\s+(.+)$/);
      const h3 = paragraph.match(/^###\s+(.+)$/);

      if (h2 ?? h3) {
        return {
          _type: 'block' as const,
          _key: `b-${i}`,
          style: h2 ? 'h2' : 'h3',
          markDefs: [],
          children: [{
            _type: 'span' as const,
            _key: `s-${i}-0`,
            text: (h2?.[1] ?? h3?.[1])!,
            marks: [],
          }],
        };
      }

      return {
        _type: 'block' as const,
        _key: `b-${i}`,
        style: 'normal',
        markDefs: [],
        children: parseInlineMarkdown(paragraph, i),
      };
    });
}

type PTSpan = { _type: 'span'; _key: string; text: string; marks: string[] };

function parseInlineMarkdown(text: string, blockIdx: number): PTSpan[] {
  const spans: PTSpan[] = [];
  let idx = 0;
  let lastEnd = 0;

  // Match **bold** before *italic* to avoid ambiguity
  const re = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > lastEnd) {
      spans.push({ _type: 'span', _key: `s-${blockIdx}-${idx++}`, text: text.slice(lastEnd, m.index), marks: [] });
    }
    const isBold = m[0].startsWith('**');
    spans.push({ _type: 'span', _key: `s-${blockIdx}-${idx++}`, text: (isBold ? m[1] : m[2])!, marks: [isBold ? 'strong' : 'em'] });
    lastEnd = m.index + m[0].length;
  }

  if (lastEnd < text.length) {
    spans.push({ _type: 'span', _key: `s-${blockIdx}-${idx}`, text: text.slice(lastEnd), marks: [] });
  }

  return spans.length > 0 ? spans : [{ _type: 'span', _key: `s-${blockIdx}-0`, text, marks: [] }];
}

type SanityCoverRef = { _type: 'image'; asset: { _type: 'reference'; _ref: string } };

export async function publishArticleToSanity(
  article:    PublishableArticle,
  personaId:  string,
  coverImage?: SanityCoverRef | null
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
    ...(coverImage ? { coverImage } : {}),
    translations: {
      en: {
        title:           article.title,
        excerpt:         article.excerpt,
        body:            markdownToPortableText(article.body),
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
