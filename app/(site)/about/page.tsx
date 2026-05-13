import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About FinCNews — AI-Powered Finance Intelligence",
  description:
    "FinCNews delivers AI-assisted finance and crypto news. Learn about our editorial methodology, AI content policy, and commitment to factual, data-driven reporting.",
  alternates: { canonical: "/about" },
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://fin-c-news.vercel.app";

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FinCNews",
  url: BASE_URL,
  logo: `${BASE_URL}/logo.jpg`,
  foundingDate: "2026",
  description: "AI-powered finance and crypto news platform covering markets, Bitcoin, macro and fintech.",
  sameAs: ["https://t.me/FinCNews", "https://x.com/fincnews"],
  contactPoint: {
    "@type": "ContactPoint",
    email: "editorial@fincnews.com",
    contactType: "editorial",
  },
};

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 border-b border-white/[0.06] pb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">About</p>
          <h1 className="text-4xl font-black tracking-tight text-white">
            Fast finance intelligence, built for 2026.
          </h1>
          <p className="mt-4 text-lg leading-8 text-zinc-400">
            FinCNews monitors the global financial and crypto landscape in real time — surfacing
            the stories that matter, analysed and published within minutes of breaking.
          </p>
        </div>

        <div className="prose prose-invert prose-zinc max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white prose-h2:mt-10 prose-h2:text-xl prose-h2:border-b prose-h2:border-white/[0.06] prose-h2:pb-3 prose-p:text-zinc-400 prose-p:leading-7 prose-li:text-zinc-400 prose-strong:text-zinc-200 prose-a:text-cyan-400">

          <h2>What We Cover</h2>
          <p>
            We publish breaking news and analysis across six verticals: <strong>Crypto</strong>,
            <strong>Markets</strong>, <strong>Economy</strong>, <strong>Fintech</strong>,
            <strong>Policy</strong>, and <strong>Companies</strong>. Our focus is English-language
            content for institutional and retail finance audiences globally.
          </p>
          <p>
            Sources include Reuters, Bloomberg, CoinDesk, CoinTelegraph, The Block, Decrypt,
            BeInCrypto, CNBC, Bitcoin Magazine, NewsBTC and CryptoSlate — monitored continuously
            for breaking developments.
          </p>

          <h2>Our Editorial Methodology</h2>
          <p>
            FinCNews uses a two-stage pipeline:
          </p>
          <ul>
            <li>
              <strong>Collection</strong> — Automated monitoring of 10+ authoritative RSS sources,
              filtered by financial relevance keywords and recency (48-hour window).
              Semantic deduplication ensures each story is covered once, with the most newsworthy
              angle prioritised.
            </li>
            <li>
              <strong>Generation</strong> — Articles are drafted by Claude AI (Anthropic),
              a large language model trained on financial and journalistic content.
              The AI is instructed to use only facts present in the source material,
              include specific numbers and named entities, and mark speculation clearly.
            </li>
          </ul>
          <p>
            Every published article includes the original source URL. We do not invent quotes,
            fabricate data, or republish content verbatim. Our AI prompt explicitly prohibits
            invented sources and requires factual grounding.
          </p>

          <h2>AI Content Disclosure</h2>
          <p>
            <strong>All content on FinCNews is AI-assisted.</strong> Articles are generated
            using Claude (Anthropic) based on verified source material from established financial
            news outlets. We disclose this clearly in accordance with emerging AI transparency
            standards and Google&apos;s content policies.
          </p>
          <p>
            AI-assisted does not mean unverified. Our system is designed to surface factual,
            source-cited financial reporting at scale — not to fabricate news.
          </p>

          <h2>Financial Disclaimer</h2>
          <p>
            <strong>Nothing published on FinCNews constitutes financial advice.</strong> All
            articles, analysis, price data and market commentary are for informational purposes
            only. FinCNews is not a licensed financial advisor. Always consult a qualified
            professional before making investment decisions.
          </p>
          <p>
            Cryptocurrency markets are highly volatile. Past performance is not indicative of
            future results. You may lose all capital invested.
          </p>

          <h2>Corrections Policy</h2>
          <p>
            We are committed to factual accuracy. If you identify an error in our reporting,
            contact us at{" "}
            <a href="mailto:editorial@fincnews.com">editorial@fincnews.com</a> with details.
            Verified corrections are applied promptly and noted within the article.
          </p>

          <h2>Contact</h2>
          <p>
            Editorial: <a href="mailto:editorial@fincnews.com">editorial@fincnews.com</a>
            <br />
            Advertising: <a href="mailto:ads@fincnews.com">ads@fincnews.com</a>
            <br />
            Telegram: <a href="https://t.me/FinCNews" target="_blank" rel="noreferrer">@FinCNews</a>
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-4 border-t border-white/[0.06] pt-8">
          <Link href="/editorial-policy" className="text-sm text-cyan-400 hover:underline">
            Editorial Policy →
          </Link>
          <Link href="/terms-and-conditions" className="text-sm text-zinc-500 hover:text-white">
            Terms & Conditions
          </Link>
          <Link href="/privacy-policy" className="text-sm text-zinc-500 hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/" className="text-sm text-zinc-600 hover:text-white">
            ← Back to FinCNews
          </Link>
        </div>
      </main>
    </>
  );
}
