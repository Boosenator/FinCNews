import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms and Conditions for using FinCNews — the AI-powered finance and crypto news portal.",
};

const LAST_UPDATED = "May 12, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {/* Header */}
      <div className="mb-10 border-b border-white/[0.06] pb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">Legal</p>
        <h1 className="text-4xl font-black tracking-tight text-white">Terms and Conditions</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="prose prose-invert prose-zinc max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white prose-h2:mt-10 prose-h2:text-xl prose-h2:border-b prose-h2:border-white/[0.06] prose-h2:pb-3 prose-p:text-zinc-400 prose-p:leading-7 prose-li:text-zinc-400 prose-strong:text-zinc-200 prose-a:text-cyan-400 hover:prose-a:underline">

        <h2>1. Definitions</h2>
        <p><strong>Company</strong> — FinCNews Ltd., the legal entity operating this news portal.</p>
        <p><strong>News Portal</strong> — The news portal operated by the Company and available at <a href="https://fin-c-news.vercel.app">fincnews.com</a>.</p>
        <p><strong>FinCNews</strong> — Collective name referring to either or both the Company or the News Portal.</p>
        <p><strong>Terms and Conditions</strong> — The latest version of the Company's Terms and Conditions as published on this page.</p>
        <p><strong>Visitor</strong> — An individual person who visits the News Portal.</p>
        <p><strong>Content</strong> — All information, articles, data, prices, and other material displayed, used or transmitted on the News Portal.</p>
        <p><strong>AI-Assisted Content</strong> — Content that is generated or processed with the assistance of artificial intelligence tools and reviewed for publication.</p>

        <h2>2. Acceptance of Terms</h2>
        <p>These Terms and Conditions govern your use of FinCNews. By visiting, reading, or continuing to use the News Portal, you agree to these Terms and Conditions.</p>
        <p>If you do not agree with these Terms and Conditions, please exit and stop using the News Portal immediately.</p>

        <h2>3. Content, Copyright & AI Disclosure</h2>
        <p>All content published on FinCNews — including articles, analysis, and market commentary — is the property of the Company and is protected under applicable copyright and intellectual property laws.</p>
        <p><strong>AI-Assisted Content.</strong> FinCNews uses artificial intelligence tools (including large language models) to assist in the research, drafting, and summarisation of news content. All AI-assisted content is reviewed before publication. The use of AI does not affect the copyright ownership of the Company over published content.</p>
        <p>Content may be used by a Visitor for personal, non-commercial purposes only. Redistribution, republication, or resale of content without prior written consent of the Company is prohibited.</p>
        <p>To request permission for any other use, contact: <a href="mailto:legal@fincnews.com">legal@fincnews.com</a>.</p>

        <h2>4. Market Data & Price Accuracy</h2>
        <p>Cryptocurrency price data displayed on the News Portal is sourced from third-party providers (including CoinGecko and other market data APIs) and is provided for informational purposes only. Prices may be delayed and may not reflect real-time market values.</p>
        <p>The Company makes no representation as to the accuracy, completeness, or timeliness of any market data displayed on the News Portal.</p>

        <h2>5. Limitation of Liability</h2>
        <p>The services and information available on the News Portal are provided on a strictly "as is," "where is," and "where available" basis. The Company does not provide any warranties, express or implied, with respect to the information provided.</p>
        <p>The Company expressly disclaims any implied warranties, including but not limited to warranties of title, non-infringement, merchantability, or fitness for a particular purpose.</p>
        <p>The Company, its affiliates, directors, officers, employees, and any third-party providers of content or technology will not be liable for any loss or damage — direct, indirect, special, consequential, or incidental — arising from:</p>
        <ul>
          <li>Use of or inability to use the News Portal or its content;</li>
          <li>Any errors, omissions, or inaccuracies in the content, including AI-assisted content;</li>
          <li>Investment or financial decisions made in reliance on content published on the News Portal;</li>
          <li>Interruption or unavailability of the News Portal or its services;</li>
          <li>Unauthorized access to or alteration of your data.</li>
        </ul>

        <h2>6. Financial Disclaimer</h2>
        <p><strong>Nothing published on FinCNews constitutes financial advice, investment advice, trading advice, or any other form of professional financial guidance.</strong></p>
        <p>Articles, opinions, price data, and analysis published on the News Portal are for informational purposes only. They do not constitute an offer, solicitation, or recommendation to buy, sell, or hold any financial instrument, cryptocurrency, or other asset.</p>
        <p>The Company and its employees strongly recommend that each Visitor conducts their own independent research and consults a qualified financial advisor before making any financial or investment decisions.</p>
        <p>Cryptocurrency markets are highly volatile. Past performance is not indicative of future results. You may lose all capital invested.</p>

        <h2>7. Third-Party Links</h2>
        <p>The News Portal may contain links to third-party websites, news sources, or affiliate partners. These links are provided for convenience only. The Company has no control over the content of third-party websites and accepts no responsibility for their content, privacy practices, or terms of service.</p>
        <p>Where affiliate links are used, this will be disclosed within the relevant content.</p>

        <h2>8. Complaints & Copyright Infringement</h2>
        <p>If you believe that any content on the News Portal infringes your intellectual property or copyright, please contact us immediately at <a href="mailto:legal@fincnews.com">legal@fincnews.com</a> with the following details:</p>
        <ul>
          <li>Details of the intellectual property owner;</li>
          <li>Identification of the specific content in question;</li>
          <li>Your contact details;</li>
          <li>A statement that the complaint is made in good faith.</li>
        </ul>
        <p>The Company will take reasonable measures to resolve valid complaints promptly.</p>

        <h2>9. Monitoring and Review</h2>
        <p>The Company reserves the right to modify these Terms and Conditions at any time. Material changes will be communicated by posting an updated version on the News Portal. Continued use of the News Portal after changes are posted constitutes acceptance of the revised Terms and Conditions.</p>
        <p>These Terms and Conditions are reviewed at least annually.</p>

        <h2>10. Governing Law</h2>
        <p>These Terms and Conditions shall be governed by and construed in accordance with applicable laws. Any disputes arising from use of the News Portal shall be subject to the exclusive jurisdiction of the competent courts.</p>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 border-t border-white/[0.06] pt-8">
        <Link href="/privacy-policy" className="text-sm text-cyan-400 hover:underline">
          Privacy Policy →
        </Link>
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">
          ← Back to FinCNews
        </Link>
      </div>
    </main>
  );
}
