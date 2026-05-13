import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Editorial Policy — FinCNews",
  description:
    "FinCNews editorial standards: source verification, AI content policy, accuracy requirements, and corrections process for our finance and crypto reporting.",
  alternates: { canonical: "/editorial-policy" },
};

const LAST_UPDATED = "May 13, 2026";

export default function EditorialPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mb-10 border-b border-white/[0.06] pb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">Editorial</p>
        <h1 className="text-4xl font-black tracking-tight text-white">Editorial Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="prose prose-invert prose-zinc max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white prose-h2:mt-10 prose-h2:text-xl prose-h2:border-b prose-h2:border-white/[0.06] prose-h2:pb-3 prose-p:text-zinc-400 prose-p:leading-7 prose-li:text-zinc-400 prose-strong:text-zinc-200 prose-a:text-cyan-400">

        <h2>1. Mission</h2>
        <p>
          FinCNews exists to make institutional-quality financial intelligence accessible in
          real time. Our editorial goal is speed without sacrificing accuracy — surfacing
          verified, data-grounded financial news as it breaks.
        </p>

        <h2>2. Source Standards</h2>
        <p>Every article published on FinCNews must meet the following source requirements:</p>
        <ul>
          <li><strong>Primary sources only</strong> — Reuters, Bloomberg, CoinDesk, CoinTelegraph, The Block, official company announcements, SEC filings, Federal Reserve statements.</li>
          <li><strong>Named entities required</strong> — Articles must reference specific organisations, people, dates and figures. Anonymous sourcing is not permitted.</li>
          <li><strong>Source URL mandatory</strong> — Every article includes a link to the original source publication.</li>
          <li><strong>No invented quotes</strong> — Direct quotations must appear verbatim in the source material.</li>
        </ul>

        <h2>3. AI Content Standards</h2>
        <p>
          FinCNews uses AI (Claude by Anthropic) to assist in article drafting. The following
          rules govern AI-generated content:
        </p>
        <ul>
          <li>AI may only use facts present in the provided source material.</li>
          <li>Speculation must be clearly labelled: &ldquo;analysts expect&rdquo;, &ldquo;could potentially&rdquo;, &ldquo;according to sources&rdquo;.</li>
          <li>AI-generated articles undergo automated validation checks before publication.</li>
          <li>All published content is disclosed as AI-assisted per our <Link href="/about">About page</Link>.</li>
        </ul>
        <p>
          We do not use AI to fabricate events, manufacture quotes or create misleading
          financial narratives. Our AI prompt explicitly prohibits these practices.
        </p>

        <h2>4. Financial Content Standards</h2>
        <p>
          As a YMYL (Your Money Your Life) publication, FinCNews applies elevated accuracy
          standards to all financial content:
        </p>
        <ul>
          <li>Price data is sourced from recognised market data providers (CoinGecko, Bloomberg).</li>
          <li>Market analysis is clearly labelled as opinion or analysis, not fact.</li>
          <li>All articles include the disclaimer: content is for informational purposes only and does not constitute financial advice.</li>
          <li>Affiliate links, where present, are disclosed within the content.</li>
        </ul>

        <h2>5. Corrections & Updates</h2>
        <p>
          When factual errors are identified:
        </p>
        <ul>
          <li>Corrections are applied to the article within 24 hours of verification.</li>
          <li>Significant corrections are noted at the top of the article with the correction date.</li>
          <li>Articles are never silently deleted — redirects and notices are used instead.</li>
        </ul>
        <p>
          To report an error: <a href="mailto:editorial@fincnews.com">editorial@fincnews.com</a>
        </p>

        <h2>6. Independence & Conflicts of Interest</h2>
        <p>
          FinCNews editorial decisions are made independently of advertiser relationships.
          Sponsored content is clearly labelled and separated from editorial content.
          Editorial staff do not hold positions in assets covered in their articles.
        </p>

        <h2>7. Sensitive Topics</h2>
        <p>
          For high-impact financial events (market crashes, exchange failures, regulatory actions),
          FinCNews applies additional verification steps:
        </p>
        <ul>
          <li>Cross-referencing against minimum two independent primary sources.</li>
          <li>Explicit uncertainty language when facts are still developing.</li>
          <li>Updates to articles as new information becomes available.</li>
        </ul>

        <h2>8. Review Cycle</h2>
        <p>
          This policy is reviewed quarterly. Material changes will be announced on the site
          and reflected in the &ldquo;Last updated&rdquo; date above.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 border-t border-white/[0.06] pt-8">
        <Link href="/about" className="text-sm text-cyan-400 hover:underline">← About FinCNews</Link>
        <Link href="/terms-and-conditions" className="text-sm text-zinc-500 hover:text-white">Terms & Conditions</Link>
        <Link href="/privacy-policy" className="text-sm text-zinc-500 hover:text-white">Privacy Policy</Link>
      </div>
    </main>
  );
}
