import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Adventure AI",
  description:
    "How Adventure AI collects, uses, and protects your personal data under India's Digital Personal Data Protection Act, 2023.",
};

const UPDATED = "8 July 2026";
const GRIEVANCE_EMAIL = "008.mainak@gmail.com";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold text-white">{children}</h2>;
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-sm leading-7 text-ink-100">
      <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
      <p className="mt-2 text-ink-400">Last updated: {UPDATED}</p>

      <p className="mt-6">
        Adventure AI (&quot;we&quot;, &quot;us&quot;) operates www.adventure-ai.in, an autonomous
        AI platform that builds and operates online businesses. This policy explains what
        personal data we process, why, and the rights you have under India&apos;s{" "}
        <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>. Adventure AI is
        the <strong>Data Fiduciary</strong> for personal data processed on this platform.
      </p>

      <H2>Personal data we collect</H2>
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li><strong>Account data:</strong> your email address and name when you sign up (via email or Google login).</li>
        <li><strong>Contact data:</strong> a phone / WhatsApp number, if you choose to provide one — used on your generated business website&apos;s WhatsApp chat button.</li>
        <li><strong>Business data:</strong> business ideas, website URLs, social profile links (Facebook/Instagram), and notes you submit for audits or company creation.</li>
        <li><strong>Payment data:</strong> processed by Razorpay. We store only order/subscription identifiers and payment status — never card, UPI, or bank details.</li>
        <li><strong>Visitor leads:</strong> when someone submits the contact form on a business website we host for you, we store their name, email, and message and route it to that business&apos;s owner.</li>
        <li><strong>Usage data:</strong> activity logs of what the AI agents did for your companies.</li>
      </ul>

      <H2>Why we process it (purpose limitation)</H2>
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li>To provide the service you signed up for: creating, hosting, and operating your online business.</li>
        <li>To process payments, grant credits, and manage subscriptions and trials.</li>
        <li>To generate AI content (plans, websites, posts, audits) from the information you give us.</li>
        <li>To respond to support requests and legal obligations.</li>
      </ul>
      <p className="mt-3">
        We collect only what is needed for these purposes, and we ask for your consent at the
        point of collection (e.g. the optional phone number field states it will appear on your
        website). We do not sell personal data, and we do not use it for advertising to you.
      </p>

      <H2>Who processes data on our behalf</H2>
      <p className="mt-3">
        We use these processors, each bound to use data only to provide their service to us:
        Supabase (database &amp; authentication), Vercel (hosting), Railway (background
        processing), Razorpay (payments), OpenAI (AI content generation — your business inputs
        are sent to generate content you request), and GitHub (code repositories created for
        your businesses). Some processors store data outside India; we transfer data only to
        jurisdictions permitted under the DPDP Act.
      </p>

      <H2>Retention</H2>
      <p className="mt-3">
        Active account data is retained while your account is active. When a company plan is
        cancelled or a trial ends, its data enters a <strong>90-day retention window</strong>{" "}
        (so you can export or reactivate), after which it becomes eligible for deletion. You may
        request earlier erasure at any time (below).
      </p>

      <H2>Your rights under the DPDP Act</H2>
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li><strong>Access:</strong> a summary of your personal data and processing activities. Every company has a one-click JSON export on its dashboard.</li>
        <li><strong>Correction &amp; erasure:</strong> ask us to correct inaccurate data or erase personal data we no longer need to retain.</li>
        <li><strong>Grievance redressal:</strong> we respond to complaints within the timelines prescribed under the Act.</li>
        <li><strong>Nomination:</strong> you may nominate a person to exercise these rights on your behalf.</li>
        <li><strong>Withdraw consent:</strong> at any time, with effect going forward (e.g. remove your phone number to remove the WhatsApp button).</li>
      </ul>
      <p className="mt-3">
        If you believe we have processed your data improperly, you may also complain to the
        <strong> Data Protection Board of India</strong> after exhausting our grievance process.
      </p>

      <H2>Children</H2>
      <p className="mt-3">
        The service is for users 18 and older. We do not knowingly process children&apos;s
        personal data.
      </p>

      <H2>Security</H2>
      <p className="mt-3">
        Data is encrypted in transit (TLS) and at rest, access is scoped per tenant with
        row-level security, activity logs are append-only, and payment webhooks are
        signature-verified. In the event of a personal data breach we will notify the Data
        Protection Board and affected users as required by the Act.
      </p>

      <H2>Grievance Officer / Contact</H2>
      <p className="mt-3">
        For any privacy request (access, correction, erasure, consent withdrawal, or
        complaint), contact:{" "}
        <a className="text-brand-400 hover:underline" href={`mailto:${GRIEVANCE_EMAIL}`}>
          {GRIEVANCE_EMAIL}
        </a>
        . Include the email address linked to your account. We aim to acknowledge within 72
        hours and resolve within 30 days.
      </p>

      <H2>Changes to this policy</H2>
      <p className="mt-3">
        We will post updates here and revise the &quot;Last updated&quot; date. Material changes
        will be notified by email.
      </p>
    </div>
  );
}
