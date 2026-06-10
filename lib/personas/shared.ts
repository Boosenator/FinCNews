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
  const blocks: PortableTextBlock[] = [];
  let keyIdx = 0;

  for (const section of markdown.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)) {
    const h2 = section.match(/^##\s+(.+)$/);
    const h3 = section.match(/^###\s+(.+)$/);

    if (h2 ?? h3) {
      blocks.push({
        _type: 'block' as const,
        _key: `b-${keyIdx++}`,
        style: h2 ? 'h2' : 'h3',
        markDefs: [],
        children: [{ _type: 'span' as const, _key: `s-${keyIdx}-0`, text: (h2?.[1] ?? h3?.[1])!, marks: [] }],
      });
      continue;
    }

    const lines = section.split('\n');
    const hasBullets = lines.some(l => /^[-*]\s/.test(l));

    if (hasBullets) {
      for (const line of lines) {
        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          blocks.push({
            _type: 'block' as const,
            _key: `b-${keyIdx++}`,
            style: 'normal',
            listItem: 'bullet' as const,
            level: 1,
            markDefs: [],
            children: parseInlineMarkdown(bullet[1], keyIdx),
          });
        } else if (line.trim()) {
          blocks.push({
            _type: 'block' as const,
            _key: `b-${keyIdx++}`,
            style: 'normal',
            markDefs: [],
            children: parseInlineMarkdown(line.trim(), keyIdx),
          });
        }
      }
    } else {
      blocks.push({
        _type: 'block' as const,
        _key: `b-${keyIdx++}`,
        style: 'normal',
        markDefs: [],
        children: parseInlineMarkdown(section, keyIdx),
      });
    }
  }

  return blocks;
}

type PTSpan = { _type: 'span'; _key: string; text: string; marks: string[] };

function parseInlineMarkdown(text: string, blockIdx: number): PTSpan[] {
  const spans: PTSpan[] = [];
  let idx = 0;
  let lastEnd = 0;

  // **bold** must be tried before *italic* to avoid partial matches
  const re = /\*\*([^*]+?)\*\*|\*([^*\n]+?)\*/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > lastEnd) {
      spans.push({ _type: 'span', _key: `s-${blockIdx}-${idx++}`, text: text.slice(lastEnd, m.index), marks: [] });
    }
    const isBold = m[0].startsWith('**');
    spans.push({
      _type: 'span',
      _key: `s-${blockIdx}-${idx++}`,
      text: (isBold ? m[1] : m[2])!,
      marks: [isBold ? 'strong' : 'em'],
    });
    lastEnd = m.index + m[0].length;
  }

  if (lastEnd < text.length) {
    spans.push({ _type: 'span', _key: `s-${blockIdx}-${idx}`, text: text.slice(lastEnd), marks: [] });
  }

  return spans.length > 0 ? spans : [{ _type: 'span', _key: `s-${blockIdx}-0`, text, marks: [] }];
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1')
    .replace(/_{2}([^_]+?)_{2}/g, '$1')
    .replace(/_([^_\n]+?)_/g, '$1')
    .replace(/`([^`]+?)`/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^#{1,3}\s+/gm, '')
    .trim();
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

// Claude sometimes emits raw control characters (literal newlines/tabs) inside
// JSON string values, which is invalid per the JSON spec. Escape any control
// character found between unescaped quotes before parsing.
function sanitizeJsonControlChars(raw: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of raw) {
    if (inString && !escaped && /[\x00-\x1f]/.test(ch)) {
      switch (ch) {
        case '\n': out += '\\n'; break;
        case '\r': out += '\\r'; break;
        case '\t': out += '\\t'; break;
        default: out += ' ';
      }
      continue;
    }
    out += ch;
    if (escaped) {
      escaped = false;
    } else if (ch === '\\') {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    }
  }
  return out;
}

export async function parseClaudeJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { content: { text: string }[] };
  const text = json.content[0]?.text ?? '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Claude returned no JSON');
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return JSON.parse(sanitizeJsonControlChars(match[0])) as T;
  }
}
