// One-off: fetch article from Sanity, convert markdown body to PortableText, patch back.
// Usage: node scripts/rewrite-article-body.mjs <slug>

import { createClient } from '@sanity/client';

const sanity = createClient({
  projectId: 'x55aaanw',
  dataset:   'production',
  token:     process.env.SANITY_TOKEN,
  apiVersion: '2024-01-01',
  useCdn: false,
});

const slug = process.argv[2];
if (!slug) { console.error('Usage: node scripts/rewrite-article-body.mjs <slug>'); process.exit(1); }

// ── markdownToPortableText ────────────────────────────────────────────────────

function parseInlineMarkdown(text, blockIdx) {
  const spans = [];
  let idx = 0, lastEnd = 0;
  const re = /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastEnd)
      spans.push({ _type: 'span', _key: `s-${blockIdx}-${idx++}`, text: text.slice(lastEnd, m.index), marks: [] });
    const isBold = m[0].startsWith('**');
    spans.push({ _type: 'span', _key: `s-${blockIdx}-${idx++}`, text: isBold ? m[1] : m[2], marks: [isBold ? 'strong' : 'em'] });
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length)
    spans.push({ _type: 'span', _key: `s-${blockIdx}-${idx}`, text: text.slice(lastEnd), marks: [] });
  return spans.length > 0 ? spans : [{ _type: 'span', _key: `s-${blockIdx}-0`, text, marks: [] }];
}

function markdownToPortableText(markdown) {
  return markdown
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map((paragraph, i) => {
      const h2 = paragraph.match(/^##\s+(.+)$/);
      const h3 = paragraph.match(/^###\s+(.+)$/);
      if (h2 || h3) {
        return {
          _type: 'block', _key: `b-${i}`,
          style: h2 ? 'h2' : 'h3',
          markDefs: [],
          children: [{ _type: 'span', _key: `s-${i}-0`, text: h2?.[1] ?? h3?.[1], marks: [] }],
        };
      }
      return { _type: 'block', _key: `b-${i}`, style: 'normal', markDefs: [], children: parseInlineMarkdown(paragraph, i) };
    });
}

// ── Main ──────────────────────────────────────────────────────────────────────

const doc = await sanity.fetch(
  `*[_type == "article" && slug.current == $slug][0]{ _id, "body": translations.en.body }`,
  { slug }
);

if (!doc) { console.error(`Article not found: ${slug}`); process.exit(1); }

if (Array.isArray(doc.body)) {
  console.log('Body is already PortableText — converting again to fix any markdown remnants.');
  // Flatten back to string then re-convert (handles case where it's partially converted)
  const asText = doc.body
    .map(b => {
      const text = b.children?.map(c => c.text).join('') ?? '';
      if (b.style === 'h2') return `## ${text}`;
      if (b.style === 'h3') return `### ${text}`;
      return text;
    })
    .join('\n\n');
  const converted = markdownToPortableText(asText);
  await sanity.patch(doc._id).set({ 'translations.en.body': converted }).commit();
  console.log(`✓ Patched ${slug} (was PortableText with markdown remnants) — ${converted.length} blocks`);
} else if (typeof doc.body === 'string') {
  const converted = markdownToPortableText(doc.body);
  await sanity.patch(doc._id).set({ 'translations.en.body': converted }).commit();
  console.log(`✓ Patched ${slug} (was string) — ${converted.length} blocks`);
} else {
  console.log('Body is null or unexpected type:', typeof doc.body);
}
