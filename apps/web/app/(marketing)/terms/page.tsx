import type { Metadata } from "next";
import Link from "next/link";
import { PLANS, CREDIT_PACKS, formatINR, TRIAL_DAYS, TRIAL_PRICE_PAISE, FREE_TRIAL_DAYS } from "@adventure/core";

export const metadata: Metadata = {
  title: "Terms & Conditions — Adventure AI",
  description:
    "Terms and conditions, pricing, refund and cancellation policy, and service delivery details for Adventure AI (www.adventure-ai.in).",
};

const UPDATED = "9 July 2026";
const CONTACT_EMAIL = "008.mainak@gmail.com";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold text-white">{children}</h2>;
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-sm leading-7 text-ink-100">
      <h1 className="text-3xl font-bold text-white">Terms &amp; Conditions</h1>
      <p className="mt-2 text-ink-400">Last updated: {UPDATED}</p>

      <p className="mt-6">
        These Terms &amp; Conditions (&quot;Terms&quot;) govern your use of{" "}
        <strong>Adventure AI</strong>, operated at <strong>www.adventure-ai.in</strong>{" "}
        (&quot;the Platform&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or
        making a payment, you agree to these Terms. If you do not agree, please do not use the
        Platform.
      </p>

      <H2>1. The service</H2>
      <p className="mt-3">
        Adventure AI is a software-as-a-service platform that uses AI agents to help you plan,
        build, and operate an online business: it generates a company foundation (name,
        positioning, launch plan), builds and deploys a website, and produces marketing
        deliverables (social posts with images, outreach emails, support replies, ad proposals,
        growth plans, and business audits) that are delivered to your account inbox. The service
        is delivered <strong>digitally and immediately</strong> through your account — nothing is
        shipped physically.
      </p>

      <H2>2. Eligibility and accounts</H2>
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li>You must be at least 18 years old and capable of entering a binding contract under Indian law.</li>
        <li>You are responsible for the accuracy of the information you provide and for keeping your login secure.</li>
        <li>One account may create at most 5 companies.</li>
      </ul>

      <H2>3. Pricing</H2>
      <p className="mt-3">All prices are in Indian Rupees (INR) and are shown before any applicable taxes.</p>
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li>
          <strong>Free trial:</strong> every new company includes a {FREE_TRIAL_DAYS}-day free
          trial with full access. No payment is collected.
        </li>
        <li>
          <strong>Limited trial:</strong> {formatINR(TRIAL_PRICE_PAISE)} one-time for{" "}
          {TRIAL_DAYS} days of full access. No mandate, no auto-renewal.
        </li>
        <li>
          <strong>Pro plan:</strong> {formatINR(PLANS.PRO.pricePaise)} per month, per company,
          billed as a recurring subscription until cancelled.
        </li>
        <li>
          <strong>Credit packs (one-time):</strong>{" "}
          {CREDIT_PACKS.map((p) => `${p.credits} credits for ${formatINR(p.pricePaise)}`).join(" · ")}.
          One on-demand task consumes one credit.
        </li>
      </ul>
      <p className="mt-3">
        Payments are processed by <strong>Razorpay</strong>. We do not store your card, UPI, or
        bank details.
      </p>

      <H2>4. Service delivery</H2>
      <p className="mt-3">
        Access is activated <strong>immediately on successful payment</strong> (or on company
        creation, for the free trial). AI-generated deliverables typically arrive in your account
        inbox within minutes of a request; the daily autonomous cycle runs once per day per
        company. As a digital service, no physical shipping is involved.
      </p>

      <H2>5. Refund &amp; cancellation policy</H2>
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li>
          <strong>Cancellation:</strong> you can cancel a Pro subscription anytime from the
          billing page. Agents stop at cancellation; no further renewals are charged. You keep
          your website repository and can export your data for 90 days.
        </li>
        <li>
          <strong>Duplicate or failed payments:</strong> if you are charged but the corresponding
          plan, trial, or credits are not activated, or you are charged twice for the same order,
          write to us within 7 days and we will refund the amount in full to the original payment
          method within 5–7 working days.
        </li>
        <li>
          <strong>Trials and credit packs</strong> are one-time digital purchases activated
          immediately, and are otherwise non-refundable once activated.
        </li>
        <li>
          <strong>Failed tasks:</strong> credits consumed by a task that fails are automatically
          refunded to your credit balance.
        </li>
        <li>
          Refund requests: email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-white">
            {CONTACT_EMAIL}
          </a>{" "}
          with your registered email and payment reference.
        </li>
      </ul>

      <H2>6. Your content and ownership</H2>
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li>You own the business ideas, images, and other content you upload, and you must have the rights to use them.</li>
        <li>The website code generated for your company lives in a GitHub repository you own; AI-generated deliverables are yours to use for your business.</li>
        <li>You are responsible for how you use AI-generated content (including publishing posts or sending emails) and for your business&apos;s compliance with applicable laws.</li>
      </ul>

      <H2>7. Acceptable use</H2>
      <p className="mt-3">
        You may not use the Platform for anything unlawful, deceptive, or harmful — including
        businesses dealing in prohibited goods or services, spam, infringing content, or attempts
        to disrupt or reverse-engineer the Platform. We may suspend accounts that violate these
        Terms.
      </p>

      <H2>8. AI-generated content disclaimer</H2>
      <p className="mt-3">
        Deliverables are generated by AI and provided &quot;as is&quot;. They may contain errors
        and are not professional, legal, financial, or investment advice. Review everything before
        you rely on it. We do not guarantee business outcomes, revenue, or search rankings.
      </p>

      <H2>9. Limitation of liability</H2>
      <p className="mt-3">
        To the maximum extent permitted by law, our total liability for any claim arising out of
        the service is limited to the amount you paid us in the 3 months preceding the claim. We
        are not liable for indirect or consequential losses, or for downtime of third-party
        services (hosting, payment, AI providers) outside our control.
      </p>

      <H2>10. Privacy</H2>
      <p className="mt-3">
        Personal data is handled per our{" "}
        <Link href="/privacy" className="underline hover:text-white">
          Privacy Policy
        </Link>{" "}
        under India&apos;s Digital Personal Data Protection Act, 2023. You can permanently delete
        your account and data anytime from the dashboard.
      </p>

      <H2>11. Changes to these terms</H2>
      <p className="mt-3">
        We may update these Terms from time to time; the &quot;Last updated&quot; date reflects
        the current version. Continued use after changes means you accept the updated Terms.
      </p>

      <H2>12. Governing law</H2>
      <p className="mt-3">
        These Terms are governed by the laws of India. Courts at Kolkata, West Bengal shall have
        exclusive jurisdiction.
      </p>

      <H2>13. Contact us</H2>
      <p className="mt-3">
        Adventure AI — www.adventure-ai.in
        <br />
        Email:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-white">
          {CONTACT_EMAIL}
        </a>
        <br />
        We aim to respond to all queries within 48 hours.
      </p>
    </div>
  );
}
