import Link from "next/link";
import { PLANS, CREDIT_PACKS, formatINR, TRIAL_DAYS, TRIAL_PRICE_PAISE, FREE_TRIAL_DAYS } from "@adventure/core";
import { Badge, Button, Card } from "@/components/ui";
import { GlowCard } from "@/components/ui/spotlight-card";

const DEMO_FEED = [
  { agent: "CEO", action: "Wrote today's brief: focus on landing page conversion + 20 outreach emails" },
  { agent: "Engineer", action: "Opened PR #14: add testimonials section to landing page — merged & deployed" },
  { agent: "Research", action: "Analyzed 3 competitors; pricing gap found at ₹999/mo tier" },
  { agent: "Email", action: "Drafted 20 personalized outreach emails — ready in your inbox" },
  { agent: "Social", action: "Generated tomorrow's post: image, caption & tags — ready to share" },
  { agent: "Finance", action: "Weekly P&L: revenue ₹42,300, ad spend ₹6,150, net +₹31,900" },
];

const FAQ = [
  {
    q: "What does the AI actually do?",
    a: "Nine specialized agents plan strategy, write and deploy code to your own GitHub repo, draft social posts and outreach emails, answer support tickets, run ads within your budget caps, and track finances — logging every action to a live feed you can watch.",
  },
  {
    q: "Do I stay in control?",
    a: "Yes. Everything the agents produce lands in your inbox as a ready-to-use deliverable — you decide what to publish and send. Ads have hard budget caps you set, and you can pause any agent at any time.",
  },
  {
    q: "Who owns the code and data?",
    a: "You do. The repo lives in your GitHub account (we keep collaborator access to operate). If you cancel, agents pause but you keep the repo plus a full data export for 90 days. No lock-in.",
  },
  {
    q: "Are there any hidden charges?",
    a: "No. You pay only your plan (or trial) and any credit packs you choose to buy. Revenue your business earns is 100% yours.",
  },
  {
    q: "What if I don't have an idea?",
    a: `Click "Surprise me". The AI generates a validated niche business idea, names the company, writes the positioning and landing page, and drafts a 30-day launch plan — your ${FREE_TRIAL_DAYS}-day free trial starts immediately, no card required.`,
  },
];

const CheckIcon = () => (
  <svg
    className="mt-0.5 h-4 w-4 shrink-0 text-brand-500"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const HERO_PLANS = [
  {
    name: "Free trial",
    price: "₹0",
    detail: `${FREE_TRIAL_DAYS} days, everything unlocked`,
  },
  {
    name: "Limited trial",
    price: formatINR(TRIAL_PRICE_PAISE),
    detail: `${TRIAL_DAYS} days, one-time, no auto-renewal`,
  },
  {
    name: "Pro",
    price: `${formatINR(PLANS.PRO.pricePaise)}/mo`,
    detail: "Agents on 24/7, per company",
  },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero — asymmetric split: pitch + plan ladder left, live feed right */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-20 lg:grid-cols-[7fr_5fr]">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
            Your AI co-founder
          </p>
          <h1 className="max-w-xl font-display text-[clamp(2.5rem,5vw,4rem)] font-bold leading-[1.08] tracking-tight">
            AI that runs your company{" "}
            <span className="text-brand-500">while you sleep</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-100/80">
            It plans, builds the website, writes the posts, answers customers, and tracks the
            money — 24/7, with every deliverable waiting in your inbox.
          </p>

          {/* Plans, stated up front */}
          <div className="mt-8 divide-y divide-ink-800 rounded-xl border border-ink-800 bg-ink-900/60">
            {HERO_PLANS.map((p, i) => (
              <div key={p.name} className="flex items-baseline gap-4 px-5 py-3">
                <span className="w-28 shrink-0 text-sm font-semibold">
                  {p.name}
                  {i === 2 && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-brand-400">popular</span>}
                </span>
                <span className="w-24 shrink-0 font-display text-lg font-bold">{p.price}</span>
                <span className="truncate text-sm text-ink-400">{p.detail}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/login">
              <Button size="lg">Start {FREE_TRIAL_DAYS} days free — no card</Button>
            </Link>
            <Link href="#pricing" className="text-sm font-medium text-ink-100 hover:text-white">
              Compare plans →
            </Link>
          </div>
          <p className="mt-4 text-xs text-ink-400">
            No revenue share, no hidden charges — what your business earns is 100% yours.
          </p>
        </div>

        {/* Live feed inside the spotlight card — the signature element */}
        <GlowCard customSize glowColor="orange" className="hidden p-0 lg:block">
          <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Live from a company run by Adventure AI</h2>
            <Badge variant="success">● live</Badge>
          </div>
          <ul className="divide-y divide-ink-800/70">
            {DEMO_FEED.map((item, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
                <Badge variant="outline" className="mt-0.5 w-20 shrink-0 justify-center text-xs">
                  {item.agent}
                </Badge>
                <span className="text-ink-100/90">{item.action}</span>
              </li>
            ))}
          </ul>
        </GlowCard>
      </section>

      {/* Mobile: feed below hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24 lg:hidden">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-ink-800 px-5 py-3.5">
            <h2 className="text-sm font-semibold">Live from a company run by Adventure AI</h2>
            <Badge variant="success">● live</Badge>
          </div>
          <ul className="divide-y divide-ink-800">
            {DEMO_FEED.map((item, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
                <Badge variant="outline" className="mt-0.5 w-20 shrink-0 justify-center text-xs">
                  {item.agent}
                </Badge>
                <span className="text-ink-100/90">{item.action}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Existing-business audit */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Card className="border-brand-500/40">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold">Already running a business?</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">
                Point us at your website and get market research, a SWOT analysis, the scope for
                your products or services, and a growth implementation plan from a senior
                marketing executive — focused on winning more sales and clients.
              </p>
            </div>
            <Link href="/login?next=/audit">
              <Button size="lg">Get my business audit</Button>
            </Link>
          </div>
        </Card>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-24">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
          Pricing
        </p>
        <h2 className="mt-3 text-center font-display text-3xl font-bold">
          Start free. Pay only to keep going.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-ink-400">
          Every company begins with {FREE_TRIAL_DAYS} days completely free — agents on, website
          deployed, no card. Then pick how you continue.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {/* Free trial */}
          <GlowCard customSize glowColor="orange" className="flex flex-col p-6">
            <h3 className="font-display text-lg font-semibold">Free trial</h3>
            <p className="mt-4 font-display text-4xl font-bold">
              ₹0<span className="text-sm font-normal text-ink-400"> / {FREE_TRIAL_DAYS} days</span>
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink-100">
              {[
                "Starts automatically with every new company",
                "All nine agents switched on",
                "Website built and deployed",
                "8 welcome credits included",
                "No card, no commitment",
              ].map((f) => (
                <li key={f} className="flex gap-2.5">
                  <CheckIcon /> {f}
                </li>
              ))}
            </ul>
            <Link href="/login" className="mt-6 block">
              <Button className="w-full" variant="secondary">
                Start free
              </Button>
            </Link>
          </GlowCard>

          {/* Limited trial */}
          <GlowCard customSize glowColor="orange" className="flex flex-col p-6">
            <h3 className="font-display text-lg font-semibold">Limited trial</h3>
            <p className="mt-4 font-display text-4xl font-bold">
              {formatINR(TRIAL_PRICE_PAISE)}
              <span className="text-sm font-normal text-ink-400"> / {TRIAL_DAYS} days</span>
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink-100">
              {[
                `Everything in Pro for ${TRIAL_DAYS} more days`,
                "One-time payment — UPI or card",
                "No mandate, no auto-renewal",
                "Keeps your site, inbox & credits",
                "Upgrade to Pro anytime",
              ].map((f) => (
                <li key={f} className="flex gap-2.5">
                  <CheckIcon /> {f}
                </li>
              ))}
            </ul>
            <Link href="/login" className="mt-6 block">
              <Button className="w-full" variant="outline">
                Continue for {formatINR(TRIAL_PRICE_PAISE)}
              </Button>
            </Link>
          </GlowCard>

          {/* Pro */}
          <GlowCard customSize glowColor="orange" className="flex flex-col border-brand-500/50 p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{PLANS.PRO.name}</h3>
              <Badge>Most popular</Badge>
            </div>
            <p className="mt-4 font-display text-4xl font-bold">
              {formatINR(PLANS.PRO.pricePaise)}
              <span className="text-sm font-normal text-ink-400"> /mo per company</span>
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm text-ink-100">
              {PLANS.PRO.features.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <CheckIcon /> {f}
                </li>
              ))}
            </ul>
            <Link href="/login" className="mt-6 block">
              <Button className="w-full">Get {PLANS.PRO.name}</Button>
            </Link>
          </GlowCard>
        </div>

        <Card className="mt-8">
          <h3 className="font-semibold">Your revenue is 100% yours</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-100">
            No revenue share, no commission. You pay only your plan — everything your business
            earns settles to you.
          </p>
          <p className="mt-4 text-sm text-ink-400">
            Need more runs? On-demand task credits:{" "}
            {CREDIT_PACKS.map((p) => `${p.credits} for ${formatINR(p.pricePaise)}`).join(" · ")}
          </p>
        </Card>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-10 text-center font-display text-3xl font-bold">Questions, answered</h2>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <Card key={item.q}>
              <h3 className="font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-100">{item.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24 text-center">
        <h2 className="font-display text-3xl font-bold">
          Your company could be running by tonight
        </h2>
        <p className="mt-3 text-ink-400">
          {FREE_TRIAL_DAYS} days free, everything unlocked. No card required.
        </p>
        <Link href="/login" className="mt-6 inline-block">
          <Button size="lg">Build my company</Button>
        </Link>
      </section>
    </main>
  );
}
