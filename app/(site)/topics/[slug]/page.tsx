import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "@portabletext/react";
import ArticleCard from "@/components/ArticleCard";
import { BASE_URL } from "@/lib/config";
import { getArticlesForTopic, getTopicHub, getTopicHubs } from "@/lib/sanity";

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  const hubs = await getTopicHubs();
  return hubs.map((hub) => ({ slug: hub.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const hub = await getTopicHub(params.slug);
  if (!hub) return {};

  return {
    title: `${hub.title} | FinCNews Topic Hub`,
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
            {Array.isArray(hub.body) && hub.body.length > 0 && (
              <div className="prose prose-invert prose-zinc max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-zinc-100">
                <PortableText value={hub.body} />
              </div>
            )}

            {hub.faqs && hub.faqs.length > 0 && (
              <section className="mt-10 border-t border-white/[0.06] pt-8">
                <h2 className="text-xl font-black tracking-tight text-white">FAQ</h2>
                <div className="mt-5 space-y-5">
                  {hub.faqs.map((faq) => (
                    <div key={faq.question}>
                      <h3 className="font-bold text-zinc-200">{faq.question}</h3>
                      <p className="mt-2 text-sm leading-6 text-zinc-500">{faq.answer}</p>
                    </div>
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
