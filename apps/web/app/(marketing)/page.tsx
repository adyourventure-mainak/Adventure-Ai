import Link from "next/link";
import { PLANS, CREDIT_PACKS, REVENUE_SHARE_PERCENT, formatINR, TRIAL_PRICE_PAISE, trialAvailable } from "@adventure/core";
import { Badge, Button, Card } from "@/components/ui";

const DEMO_FEED = [
  { agent: "CEO", action: "Wrote today's brief: focus on landing page conversion + 20 outreach emails" },
  { agent: "Engineer", action: "Opened PR #14: add testimonials section to landing page — merged & deployed" },
  { agent: "Research", action: "Analyzed 3 competitors; pricing gap found at ₹999/mo tier" },
  { agent: "Email", action: "Drafted 20 personalized outreach emails — awaiting your approval" },
  { agent: "Social", action: "Scheduled 3 posts for tomorrow (X + LinkedIn)" },
  { agent: "Finance", action: "Weekly P&L: revenue ₹42,300, ad spend ₹6,150, net +₹31,900" },
];

const FAQ = [
  {
    q: "What does the AI actually do?",
    a: "Nine specialized agents plan strategy, write and deploy code to your own GitHub repo, draft social posts and outreach emails, answer support tickets, run ads within your budget caps, and track finances — logging every action to a live feed you can watch.",
  },
  {
    q: "Do I stay in control?",
    a: "Yes. Outbound email requires your approval by default, ads have hard budget caps you set, and you can pause any agent or set autonomy to approve-everything. You can edit any drafted output before it ships.",
  },
  {
    q: "Who owns the code and data?",
    a: "You do. The repo lives in your GitHub account (we keep collaborator access to operate). If you cancel, agents pause but you keep the repo plus a full data export for 90 days. No lock-in.",
  },
  {
    q: "How does the 20% revenue share work?",
    a: `Your business accepts payments through a Razorpay Route linked account. On each payment, ${100 - REVENUE_SHARE_PERCENT}% settles to you automatically and ${REVENUE_SHARE_PERCENT}% is the platform's share — shown transparently in your Finance tab with a monthly statement.`,
  },
  {
    q: "What if I don't have an idea?",
    a: 'Click "Surprise me". The AI generates a validated niche business idea, names the company, writes the positioning and landing page, and drafts a 30-day launch plan — free, no card required.',
  },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
        <Badge className="mb-6">Autonomous business operations</Badge>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold leading-tight tracking-tight">
          AI that runs your company <span className="text-brand-500">while you sleep</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-100">
          Adventure AI is an AI co-founder: it plans, builds, markets, and operates your online
          business 24/7 — with you in control of every important decision.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/login">
            <Button size="lg">Start free — no card</Button>
          </Link>
          <Link href="#pricing">
            <Button size="lg" variant="outline">See pricing</Button>
          </Link>
        </div>
      </section>

      {/* Demo feed */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
            <h2 className="font-semibold">Live from a company run by Adventure AI</h2>
            <Badge variant="success">● live demo</Badge>
          </div>
          <ul className="divide-y divide-ink-800">
            {DEMO_FEED.map((item, i) => (
              <li key={i} className="flex items-start gap-4 px-6 py-4 text-sm">
                <Badge variant="outline" className="mt-0.5 shrink-0 w-24 justify-center">
                  {item.agent}
                </Badge>
                <span className="text-ink-100">{item.action}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Existing-business audit */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Card className="border-brand-500">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold">Already running a business?</h2>
              <p className="mt-2 text-sm text-ink-400">
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
        <h2 className="mb-10 text-center text-3xl font-bold">Pricing</h2>

        {trialAvailable() && (
          <Card className="mb-8 border-brand-500">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold">Limited-time trial</h3>
                  <Badge>Till 15 July</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-400">
                  Everything in Pro for a one-time {formatINR(TRIAL_PRICE_PAISE)} — no mandate,
                  no auto-renewal. Offer and access end 15 July.
                </p>
              </div>
              <Link href="/login">
                <Button>Try for {formatINR(TRIAL_PRICE_PAISE)}</Button>
              </Link>
            </div>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {(["FREE", "PRO", "SCALE"] as const).map((tier) => {
            const plan = PLANS[tier];
            return (
              <Card key={tier} className={tier === "PRO" ? "border-brand-500" : ""}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  {tier === "PRO" && <Badge>Most popular</Badge>}
                </div>
                <p className="mt-4 text-3xl font-bold">
                  {plan.pricePaise === 0 ? "₹0" : formatINR(plan.pricePaise)}
                  {plan.pricePaise > 0 && (
                    <span className="text-sm font-normal text-ink-400"> /mo per company</span>
                  )}
                </p>
                <ul className="mt-6 space-y-2 text-sm text-ink-100">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="mt-6 block">
                  <Button className="w-full" variant={tier === "PRO" ? "default" : "secondary"}>
                    {tier === "FREE" ? "Start free" : `Get ${plan.name}`}
                  </Button>
                </Link>
              </Card>
            );
          })}
        </div>

        <Card className="mt-8">
          <h3 className="font-semibold">Plus a {REVENUE_SHARE_PERCENT}% revenue share — aligned incentives</h3>
          <p className="mt-2 text-sm text-ink-100">
            We keep {REVENUE_SHARE_PERCENT}% of the revenue your business processes through its
            payment account, settled automatically via Razorpay Route. We only make real money when
            your business does. Every rupee is itemized in your Finance tab.
          </p>
          <p className="mt-4 text-sm text-ink-400">
            Need more runs? On-demand task credits:{" "}
            {CREDIT_PACKS.map((p) => `${p.credits} for ${formatINR(p.pricePaise)}`).join(" · ")}
          </p>
        </Card>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-10 text-center text-3xl font-bold">Questions, answered</h2>
        <div className="space-y-4">
          {FAQ.map((item) => (
            <Card key={item.q}>
              <h3 className="font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm text-ink-100">{item.a}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Testimonials placeholder */}
      <section className="mx-auto max-w-6xl px-6 pb-24 text-center">
        <h2 className="text-3xl font-bold">Founders will say nice things here soon</h2>
        <p className="mt-3 text-ink-400">Early access is open — be the first testimonial.</p>
        <Link href="/login" className="mt-6 inline-block">
          <Button size="lg">Build my company</Button>
        </Link>
      </section>
    </main>
  );
}
