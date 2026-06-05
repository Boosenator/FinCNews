import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard";
import { getArticlesByPersona } from "@/lib/sanity";
import { BASE_URL } from "@/lib/config";

// ─── Static author profiles ──────────────────────────────────────────────────

interface AuthorProfile {
  id: string;
  name: string;
  role: string;
  avatar: string;
  bio: string;
  philosophy: string;
  focus: string[];
}

const AUTHORS: Record<string, AuthorProfile> = {
  "elena-voss": {
    id: "elena-voss",
    name: "Elena Voss",
    role: "Macro Bear",
    avatar: "/authors/elena-voss.png",
    bio: "12 years in traditional finance — fixed income at Deutsche Bank Frankfurt, macro at a European family office in Zurich. Entered crypto in 2021 through a client allocation. Remains skeptical of narratives that ignore the broader monetary environment. Covers Fed policy, Treasury yields, dollar strength, and the intersection of macro forces with crypto markets.",
    philosophy: "BTC is a risk asset. Until the Fed pivots and stays pivoted, crypto operates in the same liquidity environment as every other risk asset. The macro context is not separate from the crypto trade — it IS the trade.",
    focus: ["Fed Policy", "Treasury Yields", "Yield Curve", "DXY", "CPI / PCE", "SEC Regulation", "BTC/Macro Correlations"],
  },
};

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  return Object.keys(AUTHORS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const author = AUTHORS[params.slug];
  if (!author) return {};
  return {
    title: `${author.name} — ${author.role} | FinCNews`,
    description: author.bio,
    alternates: { canonical: `/author/${params.slug}` },
    openGraph: {
      title: `${author.name} — ${author.role}`,
      description: author.bio,
      images: [{ url: `${BASE_URL}${author.avatar}` }],
    },
  };
}

export default async function AuthorPage({ params }: Props) {
  const author = AUTHORS[params.slug];
  if (!author) notFound();

  const articles = await getArticlesByPersona(author.id);

  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    jobTitle: author.role,
    description: author.bio,
    image: `${BASE_URL}${author.avatar}`,
    url: `${BASE_URL}/author/${params.slug}`,
    worksFor: { "@type": "Organization", name: "FinCNews", url: BASE_URL },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">

        {/* Author header */}
        <div className="mb-12 flex flex-col gap-8 sm:flex-row sm:items-start">
          <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/[0.08] sm:h-36 sm:w-36">
            <Image
              src={author.avatar}
              alt={author.name}
              fill
              className="object-cover"
              priority
            />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black text-white">{author.name}</h1>
              <span className="rounded-full border border-cyan-400/30 px-3 py-1 text-xs font-bold text-cyan-400">
                {author.role}
              </span>
            </div>

            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-400">{author.bio}</p>

            {/* Philosophy quote */}
            <blockquote className="mt-5 border-l-2 border-cyan-400/40 pl-4">
              <p className="text-sm italic leading-6 text-zinc-500">&ldquo;{author.philosophy}&rdquo;</p>
            </blockquote>

            {/* Focus areas */}
            <div className="mt-5 flex flex-wrap gap-2">
              {author.focus.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-white/[0.06] px-2.5 py-1 text-xs text-zinc-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Articles */}
        <div>
          <h2 className="mb-6 text-xs font-bold uppercase tracking-widest text-zinc-600">
            Articles by {author.name}
            {articles.length > 0 && (
              <span className="ml-2 text-zinc-700">({articles.length})</span>
            )}
          </h2>

          {articles.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 px-6 py-12 text-center">
              <p className="text-sm text-zinc-600">No articles published yet.</p>
              <p className="mt-1 text-xs text-zinc-700">Check back soon — {author.name} is warming up.</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard key={article._id} article={article} />
              ))}
            </div>
          )}
        </div>

        {/* Back */}
        <div className="mt-12">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">
            ← Back to FinCNews
          </Link>
        </div>
      </main>
    </>
  );
}
