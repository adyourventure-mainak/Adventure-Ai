"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PLANS, CREDIT_PACKS, formatINR, REVENUE_SHARE_PERCENT, TRIAL_PRICE_PAISE, trialAvailable } from "@adventure/core";
import { Badge, Button, Card } from "@/components/ui";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function BillingPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [loadingPack, setLoadingPack] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (document.getElementById("rzp-script")) return;
    const s = document.createElement("script");
    s.id = "rzp-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    document.body.appendChild(s);
  }, []);

  async function subscribe(tier: "PRO" | "SCALE") {
    setLoadingTier(tier);
    setError(null);
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, tier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      if (!window.Razorpay) throw new Error("Payment library failed to load. Refresh and retry.");

      new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscriptionId,
        name: "Adventure AI",
        description: `${PLANS[tier].name} plan — ${data.companyName}`,
        theme: { color: "#fb7f14" },
        handler: () => {
          // Webhook flips the plan; send the user back to the company page.
          router.push(`/c/${slug}?upgraded=1`);
        },
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoadingTier(null);
    }
  }

  async function startTrial() {
    setLoadingTier("TRIAL");
    setError(null);
    try {
      const res = await fetch("/api/billing/trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      if (!window.Razorpay) throw new Error("Payment library failed to load. Refresh and retry.");

      new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: data.orderId,
        amount: data.amountPaise,
        currency: "INR",
        name: "Adventure AI",
        description: `Trial till 15 July — ${data.companyName}`,
        theme: { color: "#fb7f14" },
        handler: () => {
          // Webhook activates the trial; back to the company page.
          router.push(`/c/${slug}?upgraded=1`);
        },
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoadingTier(null);
    }
  }

  async function buyCredits(credits: number) {
    setLoadingPack(credits);
    setError(null);
    try {
      const res = await fetch("/api/billing/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, credits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      if (!window.Razorpay) throw new Error("Payment library failed to load. Refresh and retry.");

      new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: data.orderId,
        amount: data.amountPaise,
        currency: "INR",
        name: "Adventure AI",
        description: `${data.credits} credits — ${data.companyName}`,
        theme: { color: "#fb7f14" },
        handler: () => {
          // Webhook grants the credits; back to the company page.
          router.push(`/c/${slug}?credits=1`);
        },
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoadingPack(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold">Upgrade this company</h1>
      <p className="mt-2 text-sm text-ink-400">
        UPI Autopay and card mandates supported. Cancel anytime — you keep your repo and a full
        data export for 90 days.
      </p>

      {trialAvailable() && (
        <Card className="mt-8 border-brand-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Limited-time trial</h2>
                <Badge>Till 15 July</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-400">
                Everything in Pro until 15 July for a one-time {formatINR(TRIAL_PRICE_PAISE)} —
                no mandate, no auto-renewal.
              </p>
            </div>
            <Button disabled={loadingTier !== null} onClick={startTrial}>
              {loadingTier === "TRIAL" ? "Opening checkout…" : `Try for ${formatINR(TRIAL_PRICE_PAISE)}`}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {(["PRO", "SCALE"] as const).map((tier) => {
          const plan = PLANS[tier];
          return (
            <Card key={tier} className={tier === "PRO" ? "border-brand-500" : ""}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{plan.name}</h2>
                {tier === "PRO" && <Badge>Recommended</Badge>}
              </div>
              <p className="mt-4 text-3xl font-bold">
                {formatINR(plan.pricePaise)}
                <span className="text-sm font-normal text-ink-400"> /mo</span>
              </p>
              <ul className="mt-6 space-y-2 text-sm text-ink-100">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-brand-500">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                disabled={loadingTier !== null}
                onClick={() => subscribe(tier)}
              >
                {loadingTier === tier ? "Opening checkout…" : `Subscribe to ${plan.name}`}
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Credit packs</h2>
        <p className="mt-1 text-sm text-ink-400">
          For on-demand tasks beyond your included daily cycle. One task = one credit; failed
          tasks are auto-refunded.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.credits} className="text-center">
              <p className="text-2xl font-bold">{pack.credits}</p>
              <p className="text-xs text-ink-400">credits</p>
              <p className="mt-2 font-semibold">{formatINR(pack.pricePaise)}</p>
              <p className="text-xs text-ink-400">
                {formatINR(Math.round(pack.pricePaise / pack.credits))}/credit
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                disabled={loadingPack !== null}
                onClick={() => buyCredits(pack.credits)}
              >
                {loadingPack === pack.credits ? "Opening checkout…" : "Buy"}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs text-ink-400">
        All plans also include a {REVENUE_SHARE_PERCENT}% revenue share on business revenue
        processed through your linked payment account — itemized monthly in the Finance tab.
      </p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
