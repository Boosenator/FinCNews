import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BASE_URL } from "@/lib/config";
import { getArticlesByPersona } from "@/lib/sanity";
import ArticleCard from "@/components/ArticleCard";

const AUTHORS: Record<string, {
  name: string;
  role: string;
  avatar: string;
  accent: string;
  tag: string;
  bio: string;
  focus: string[];
}> = {
  "elena-voss": {
    name:   "Elena Voss",
    role:   "Macro Analyst",
    avatar: "/authors/elena-voss.png",
    accent: "border-violet-500/30",
    tag:    "text-violet-400 bg-violet-400/10",
    bio:    "12 years in traditional finance — fixed income at Deutsche Bank, macro at a European family office. Covers Fed policy, Treasury yields, DXY, and the intersection of macro forces with crypto markets.",
    focus:  ["Fed Policy", "Treasury Yields", "DXY", "CPI / PCE", "SEC Regulation"],
  },
  "marcus-webb": {
    name:   "Marcus Webb",
    role:   "On-Chain Analyst",
    avatar: "/authors/marcus-webb.png",
    accent: "border-teal-500/30",
    tag:    "text-teal-400 bg-teal-400/10",
    bio:    "Former quant analyst with 6 years in on-chain surveillance. Publishes only when a metric deviates significantly from its 30-day baseline. No narrative — only anomalies.",
    focus:  ["Exchange Flows", "Hashrate", "Mempool", "UTXO Analysis", "Miner Behavior"],
  },
  "leo-cruz": {
    name:   "Leo Cruz",
    role:   "Narrative Analyst",
    avatar: "/authors/leo-cruz.png",
    accent: "border-orange-500/30",
    tag:    "text-orange-400 bg-orange-400/10",
    bio:    "Entered crypto in DeFi Summer 2020. Tracks how narratives form, peak, and die — mapping trending tokens, sentiment shifts, and rotation signals before they hit mainstream coverage.",
    focus:  ["Trending Tokens", "Narrative Cycles", "Sentiment Shifts", "Reddit / CT", "DeFi"],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = AUTHORS[id];
  if (!a) return {};
  return {
    title: `${a.name} — ${a.role} | FinCNews`,
    description: a.bio,
    alternates: { canonical: `${BASE_URL}/author/${id}` },
    openGraph: {
      title: `${a.name} — ${a.role} | FinCNews`,
      description: a.bio,
      url: `${BASE_URL}/author/${id}`,
      images: [{ url: `${BASE_URL}${a.avatar}`, width: 400, height: 400, alt: a.name }],
    },
    twitter: {
      card: "summary",
      title: `${a.name} — ${a.role} | FinCNews`,
      description: a.bio,
      images: [`${BASE_URL}${a.avatar}`],
    },
  };
}

export function generateStaticParams() {
  return Object.keys(AUTHORS).map((id) => ({ id }));
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = AUTHORS[id];
  if (!a) notFound();

  const articles = await getArticlesByPersona(id, 24);
  const authorUrl = `${BASE_URL}/author/${id}`;

  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: a.name,
    jobTitle: a.role,
    description: a.bio,
    url: authorUrl,
    image: `${BASE_URL}${a.avatar}`,
    worksFor: { "@type": "Organization", name: "FinCNews", url: BASE_URL },
    knowsAbout: a.focus,
  };

  const profilePageSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: personSchema,
    url: authorUrl,
    name: `${a.name} | FinCNews`,
    description: a.bio,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Our Analysts", item: `${BASE_URL}/author` },
      { "@type": "ListItem", position: 3, name: a.name, item: authorUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(profilePageSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Author header */}
      <div className={`mb-10 flex items-start gap-6 rounded-xl border bg-zinc-900/40 p-6 ${a.accent}`}>
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border border-white/[0.1]">
          <Image src={a.avatar} alt={a.name} fill className="object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <h1 className="text-2xl font-black text-white">{a.name}</h1>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${a.tag}`}>
              {a.role}
            </span>
          </div>
          <p className="text-sm leading-6 text-zinc-400 max-w-2xl mb-4">{a.bio}</p>
          <div className="flex flex-wrap gap-1.5">
            {a.focus.map((tag) => (
              <span key={tag} className="rounded border border-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-600">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Articles */}
      <div className="mb-6 flex items-center gap-3">
        <span className="h-4 w-0.5 rounded-full bg-cyan-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          {articles.length > 0 ? `${articles.length} Articles` : "Articles"}
        </span>
      </div>

      {articles.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article._id} article={article} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600">No articles published yet.</p>
      )}

      <div className="mt-10">
        <Link href="/author" className="text-xs font-semibold text-zinc-500 transition hover:text-cyan-400">
          ← Back to the team
        </Link>
      </div>
    </main>
    </>
  );
}
