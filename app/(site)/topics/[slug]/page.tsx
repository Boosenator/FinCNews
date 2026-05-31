import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import ArticleCard from "@/components/ArticleCard";
import { BASE_URL } from "@/lib/config";
import { getArticlesForTopic, getTopicHub, getTopicHubs, type PortableTextBlock } from "@/lib/sanity";

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  const hubs = await getTopicHubs();
  return hubs.map((hub) => ({ slug: hub.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const hub = await getTopicHub(params.slug);
  if (!hub) return {};

  return {
    title: `${hub.title} Topic Hub`,
    description: hub.description,
    alternates: { canonical: `/topics/${hub.slug}` },
    openGraph: {
      title: `${hub.title} | FinCNews`,
      description: hub.description,
      type: "website",
      url: `${BASE_URL}/topics/${hub.slug}`,
      siteName: "FinCNews",
      images: [{ url: `${BASE_URL}/opengraph-image`, width: 1200, height: 630, alt: hub.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${hub.title} | FinCNews`,
      description: hub.description,
      site: "@fincnews",
      images: [`${BASE_URL}/opengraph-image`],
    },
  };
}

export default async function TopicHubPage({ params }: Props) {
  const hub = await getTopicHub(params.slug);
  if (!hub) notFound();

  const body = normalizeTopicBody(hub.body);
  const related = await getArticlesForTopic(hub.keywords ?? [hub.title], 12);
  const updated = hub.updatedAt ? new Date(hub.updatedAt) : null;

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: hub.title,
    description: hub.description,
    url: `${BASE_URL}/topics/${hub.slug}`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: related.map((article, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${BASE_URL}/${article.category}/${article.slug}`,
        name: article.en?.title,
      })),
    },
  };

  const faqSchema = hub.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: hub.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />
      {faqSchema && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 border-b border-white/[0.06] pb-6">
          <Link href="/topics" className="mb-3 inline-block text-xs font-semibold text-zinc-500 transition hover:text-cyan-400">
            Topics
          </Link>
          <h1 className="max-w-4xl text-3xl font-black tracking-tight text-white sm:text-4xl">{hub.title}</h1>
          {hub.description && <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-400">{hub.description}</p>}
          {updated && (
            <p className="mt-3 text-xs text-zinc-600">
              Updated {updated.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <article>
            {body.length > 0 && (
              <div className="prose prose-invert prose-zinc max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-zinc-100">
                <PortableText value={body} />
              </div>
            )}

            {hub.faqs && hub.faqs.length > 0 && (
              <section className="mt-10 border-t border-white/[0.06] pt-8">
                <h2 className="text-xl font-black tracking-tight text-white">FAQ</h2>
                <div className="mt-5 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-zinc-900/30">
                  {hub.faqs.map((faq) => (
                    <details key={faq.question} className="group p-5" open={hub.faqs?.[0]?.question === faq.question}>
                      <summary className="cursor-pointer list-none font-bold text-zinc-200 marker:hidden">
                        <span className="inline-flex w-full items-center justify-between gap-4">
                          {faq.question}
                          <span className="text-xs text-zinc-600 transition group-open:rotate-45">+</span>
                        </span>
                      </summary>
                      <p className="mt-3 text-sm leading-6 text-zinc-500">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside>
            {related.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 p-5">
                <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Latest related news</h2>
                <div className="divide-y divide-white/[0.04]">
                  {related.slice(0, 8).map((article) => (
                    <ArticleCard key={article._id} article={article} size="compact" />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

function normalizeTopicBody(body: PortableTextBlock[] | string | undefined): PortableTextBlock[] {
  const text = portableTextToMarkdown(body);
  if (!text) return [];

  const beforeFaq = text.split(/\n\s*FAQ\s*\n/i)[0] ?? text;
  const lines = beforeFaq
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index) => !(index === 0 && /^#\s+/.test(line)));

  const blocks: PortableTextBlock[] = [];
  let listIndex = 0;

  lines.forEach((line, index) => {
    if (/^---+$/.test(line)) return;

    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);
    const sectionHeading = line.match(/^(What It Is|Why It Matters|Latest Developments|What to Watch|How FinCNews Covers It)$/i);

    const style = h2 || sectionHeading ? "h2" : h3 ? "h3" : "normal";
    const textValue = h2?.[1] ?? h3?.[1] ?? bullet?.[1] ?? sectionHeading?.[1] ?? line;
    const parsed = parseInline(textValue, index);

    blocks.push({
      _type: "block",
      _key: `topic-${index}`,
      style,
      ...(bullet ? { listItem: "bullet", level: 1, _key: `topic-list-${listIndex++}` } : {}),
      markDefs: parsed.markDefs,
      children: parsed.children,
    } as PortableTextBlock);
  });

  return blocks;
}

function portableTextToMarkdown(body: PortableTextBlock[] | string | undefined): string {
  if (!body) return "";
  if (typeof body === "string") return body;

  return body
    .map((block) => {
      const text = block.children?.map((child) => child.text).join("") ?? "";
      if (!text.trim()) return "";
      if (block.style === "h2") return `## ${text}`;
      if (block.style === "h3") return `### ${text}`;
      return text;
    })
    .join("\n");
}

function parseInline(text: string, blockIndex: number) {
  const markDefs: Array<{ _type: "link"; _key: string; href: string }> = [];
  const children: Array<{ _type: "span"; _key: string; text: string; marks: string[] }> = [];
  const re = /(\*\*([^*]+)\*\*)|\[([^\]]+)\]\(([^)]+)\)|(\/(?:crypto|markets|economy|fintech|policy|companies)\/[a-z0-9-]+)/g;
  let last = 0;
  let spanIndex = 0;
  let match: RegExpExecArray | null;

  function pushSpan(value: string, marks: string[] = []) {
    if (!value) return;
    children.push({ _type: "span", _key: `topic-s-${blockIndex}-${spanIndex++}`, text: value, marks });
  }

  while ((match = re.exec(text)) !== null) {
    pushSpan(text.slice(last, match.index));

    if (match[2]) {
      pushSpan(match[2], ["strong"]);
    } else {
      const label = match[3] ?? match[5];
      const href = match[4] ?? match[5];
      const key = `topic-link-${blockIndex}-${spanIndex}`;
      markDefs.push({ _type: "link", _key: key, href });
      pushSpan(label, [key]);
    }

    last = match.index + match[0].length;
  }

  pushSpan(text.slice(last));
  return { markDefs, children };
}
