import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "FinCNews Privacy Policy — how we collect, use and protect your personal data.",
};

const LAST_UPDATED = "May 12, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      {/* Header */}
      <div className="mb-10 border-b border-white/[0.06] pb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-cyan-400">Legal</p>
        <h1 className="text-4xl font-black tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="prose prose-invert prose-zinc max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-white prose-h2:mt-10 prose-h2:text-xl prose-h2:border-b prose-h2:border-white/[0.06] prose-h2:pb-3 prose-p:text-zinc-400 prose-p:leading-7 prose-li:text-zinc-400 prose-strong:text-zinc-200 prose-a:text-cyan-400 hover:prose-a:underline">

        <h2>1. Definitions</h2>
        <p><strong>Company</strong> — FinCNews Ltd., the legal entity operating this news portal.</p>
        <p><strong>News Portal</strong> — The website operated by the Company and available at <a href="https://fin-c-news.vercel.app">fincnews.com</a>.</p>
        <p><strong>FinCNews</strong> — Collective name referring to either or both the Company or the News Portal.</p>
        <p><strong>Privacy Policy</strong> — The latest version of this document.</p>
        <p><strong>Visitor</strong> — An individual person visiting the News Portal.</p>
        <p><strong>Personal Data</strong> — Any information relating to a Visitor that identifies or may identify that Visitor, including but not limited to name, email address, and IP address.</p>
        <p><strong>GDPR</strong> — The General Data Protection Regulation (EU) 2016/679.</p>

        <h2>2. Purpose and Scope</h2>
        <p>This Privacy Policy explains how FinCNews collects, uses, stores, and protects the personal data of its Visitors. It has been prepared in compliance with the GDPR and other applicable data protection regulations, including the ePrivacy Directive.</p>
        <p>If the Company makes significant changes to how it processes personal data, Visitors will be notified via a notice on the News Portal or by email (where an email address is held) before changes take effect.</p>

        <h2>3. What Data We Collect</h2>
        <p>FinCNews collects only the minimum personal data necessary for the provision and improvement of its services. This may include:</p>
        <ul>
          <li><strong>Usage data</strong> — pages visited, time spent, referring URL, browser type, and device type, collected via analytics tools;</li>
          <li><strong>Email address</strong> — collected only if a Visitor voluntarily subscribes to the Telegram channel or newsletter;</li>
          <li><strong>IP address</strong> — collected automatically for security and fraud prevention purposes.</li>
        </ul>
        <p>The legal bases for processing personal data include:</p>
        <ul>
          <li>Explicit consent (e.g., newsletter subscription);</li>
          <li>Legitimate interest (e.g., cybersecurity, analytics, fraud prevention);</li>
          <li>Compliance with legal obligations.</li>
        </ul>
        <p>Visitors may contact <a href="mailto:privacy@fincnews.com">privacy@fincnews.com</a> to request details on the personal data held about them.</p>

        <h2>4. Analytics</h2>
        <p>FinCNews uses privacy-respecting analytics tools to understand how Visitors use the News Portal. Where possible, we prefer tools that do not require cookie consent (e.g., server-side analytics, privacy-first tools such as Plausible or Umami).</p>
        <p>Where analytics tools set cookies or collect identifiable data, explicit consent will be requested via a cookie banner in compliance with the ePrivacy Directive.</p>

        <h2>5. Telegram Channel</h2>
        <p>FinCNews operates a Telegram channel. If you subscribe to the channel, your Telegram username and profile data are handled by Telegram in accordance with <a href="https://telegram.org/privacy" target="_blank" rel="noreferrer">Telegram's own Privacy Policy</a>. FinCNews does not separately store or process your Telegram personal data.</p>

        <h2>6. Cookies</h2>
        <p>FinCNews uses the following types of cookies:</p>
        <ul>
          <li><strong>Strictly necessary cookies</strong> — required for the News Portal to function. No consent is required.</li>
          <li><strong>Analytics cookies</strong> — used to understand how Visitors navigate the site. Consent is required before these are set.</li>
        </ul>
        <p>Visitors can manage or withdraw cookie consent at any time through their browser settings.</p>

        <h2>7. AI-Assisted Content & Data</h2>
        <p>FinCNews uses artificial intelligence tools to assist in content creation. No personal data of Visitors is used as training data for AI models, shared with AI providers beyond what is necessary for content generation, or stored by AI providers beyond the processing of individual requests.</p>

        <h2>8. Third-Party Processors</h2>
        <p>FinCNews may use trusted third-party service providers to operate the News Portal, including hosting providers, content delivery networks, and analytics services. These processors act under contract and are bound by data protection obligations. An up-to-date list of processors can be requested at <a href="mailto:privacy@fincnews.com">privacy@fincnews.com</a>.</p>

        <h2>9. Data Retention</h2>
        <p>Personal data is retained only for as long as necessary for the purpose for which it was collected:</p>
        <ul>
          <li><strong>Analytics data</strong> — retained for up to 24 months in aggregated, anonymised form;</li>
          <li><strong>Marketing and subscription data</strong> — retained until consent is withdrawn;</li>
          <li><strong>Legal compliance data</strong> — retained as required by applicable law.</li>
        </ul>
        <p>When data is no longer required, it is securely deleted or anonymised.</p>

        <h2>10. Your Rights</h2>
        <p>Under the GDPR, Visitors have the following rights regarding their personal data:</p>
        <ul>
          <li><strong>Right of access</strong> — to request a copy of personal data held;</li>
          <li><strong>Right to rectification</strong> — to correct inaccurate data;</li>
          <li><strong>Right to erasure</strong> — to request deletion of personal data where no legal basis for retention exists;</li>
          <li><strong>Right to restrict processing</strong> — to limit how data is used;</li>
          <li><strong>Right to data portability</strong> — to receive data in a structured, machine-readable format;</li>
          <li><strong>Right to object</strong> — to object to processing based on legitimate interest.</li>
        </ul>
        <p>To exercise any of these rights, contact: <a href="mailto:privacy@fincnews.com">privacy@fincnews.com</a>.</p>

        <h2>11. Right to Lodge a Complaint</h2>
        <p>If you believe your personal data is not being processed in compliance with the GDPR, you have the right to lodge a complaint with a supervisory authority. In the EU, you may contact the data protection authority in your country of residence.</p>

        <h2>12. International Data Transfers</h2>
        <p>FinCNews uses cloud infrastructure that may process data outside the EU/EEA. Where such transfers occur to countries not deemed adequate by the European Commission, appropriate safeguards are applied, including Standard Contractual Clauses (SCC) approved by the European Commission.</p>

        <h2>13. Changes to This Policy</h2>
        <p>The Company reserves the right to modify this Privacy Policy at any time. Material changes will be communicated by posting an updated version on the News Portal. The effective date at the top of this page will reflect the latest revision.</p>
        <p>This Policy is reviewed at least annually.</p>

        <h2>14. Contact</h2>
        <p>For any privacy-related queries, requests, or complaints, please contact:</p>
        <p>
          <strong>FinCNews Ltd.</strong><br />
          Email: <a href="mailto:privacy@fincnews.com">privacy@fincnews.com</a>
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-4 border-t border-white/[0.06] pt-8">
        <Link href="/terms-and-conditions" className="text-sm text-cyan-400 hover:underline">
          Terms and Conditions →
        </Link>
        <Link href="/" className="text-sm text-zinc-500 hover:text-white">
          ← Back to FinCNews
        </Link>
      </div>
    </main>
  );
}
