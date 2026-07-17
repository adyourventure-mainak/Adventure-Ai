"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  PLANS,
  CREDIT_PACKS,
  formatINR,
  TRIAL_DAYS,
  TRIAL_PRICE_PAISE,
  GST_PERCENT,
  withGst,
  applyCouponToBase,
} from "@adventure/core";
import { Badge, Button, Card, Input } from "@/components/ui";
import { DeleteCompany } from "@/components/delete-company";

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
  const [status, setStatus] = useState<{
    planTier: "FREE" | "TRIAL" | "PRO" | "SCALE";
    companyStatus: string;
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    trialExpired?: boolean;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  // A validated 50/70% coupon held for the next trial/credit checkout.
  const [discount, setDiscount] = useState<{ code: string; percentOff: number } | null>(null);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setApplyingCoupon(true);
    setCouponMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${slug}/coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid coupon");
      if (data.kind === "comp") {
        router.push(`/c/${slug}?upgraded=1`);
        return;
      }
      // 50/70% — hold it and apply at checkout.
      setDiscount({ code: data.code, percentOff: data.percentOff });
      setCouponMsg(`${data.percentOff}% off applied — it'll come off the trial and credit packs below.`);
    } catch (e) {
      setDiscount(null);
      setCouponMsg(e instanceof Error ? e.message : "Invalid coupon");
    } finally {
      setApplyingCoupon(false);
    }
  }

  useEffect(() => {
    fetch(`/api/billing/status?slug=${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
  }, [slug]);

  async function cancelPlan() {
    if (!window.confirm("Cancel this plan? Agents stop and the company enters a 90-day retention window.")) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not cancel");
      router.push(`/c/${slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setCancelling(false);
    }
  }

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
      if (data.activated) {
        // Billing test mode: no payment needed.
        router.push(`/c/${slug}?upgraded=1`);
        return;
      }
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
        body: JSON.stringify({ slug, ...(discount ? { couponCode: discount.code } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      if (data.activated) {
        // Billing test mode: no payment needed.
        router.push(`/c/${slug}?upgraded=1`);
        return;
      }
      if (!window.Razorpay) throw new Error("Payment library failed to load. Refresh and retry.");

      new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: data.orderId,
        amount: data.amountPaise,
        currency: "INR",
        name: "Adventure AI",
        description: `${TRIAL_DAYS}-day trial — ${data.companyName}`,
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
        body: JSON.stringify({ slug, credits, ...(discount ? { couponCode: discount.code } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start checkout");
      if (data.activated) {
        // Billing test mode: no payment needed.
        router.push(`/c/${slug}?credits=1`);
        return;
      }
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
        data export for 90 days. All prices shown are exclusive of {GST_PERCENT}% GST, added at
        checkout.
      </p>

      <Card className="mt-6">
        <h2 className="font-semibold">Have a coupon?</h2>
        <p className="mt-1 text-sm text-ink-400">
          Enter a code from us — it can unlock a free plan or a discount.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            placeholder="COUPON CODE"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            className="max-w-xs uppercase"
          />
          <Button
            variant="outline"
            disabled={applyingCoupon || couponInput.trim().length < 3}
            onClick={applyCoupon}
          >
            {applyingCoupon ? "Applying…" : "Apply"}
          </Button>
          {discount && <Badge variant="success">{discount.percentOff}% off held</Badge>}
        </div>
        {couponMsg && (
          <p className={`mt-2 text-sm ${discount ? "text-emerald-400" : "text-red-400"}`}>{couponMsg}</p>
        )}
      </Card>

      {status && status.planTier !== "FREE" && status.companyStatus !== "LAPSED" && !status.trialExpired && (
        <Card className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Current plan: {PLANS[status.planTier].name}</h2>
                <Badge variant={status.companyStatus === "ACTIVE" ? "success" : "outline"}>
                  {status.companyStatus}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-ink-400">
                {status.currentPeriodEnd
                  ? `Renews ${new Date(status.currentPeriodEnd).toLocaleDateString("en-IN")}.`
                  : status.planTier === "TRIAL"
                    ? `One-time ${TRIAL_DAYS}-day trial — no auto-renewal.`
                    : "No renewal scheduled."}{" "}
                Switch plans below, or cancel — you keep your repo and a full data export for 90 days.
              </p>
            </div>
            <Button variant="outline" disabled={cancelling} onClick={cancelPlan}>
              {cancelling ? "Cancelling…" : "Cancel plan"}
            </Button>
          </div>
        </Card>
      )}

      {status && (status.planTier === "FREE" || status.trialExpired || (status.planTier === "TRIAL" && status.companyStatus === "LAPSED")) && (
        <Card className="mt-8 border-brand-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">
                  {status.trialExpired || status.companyStatus === "LAPSED"
                    ? "Your trial has ended — choose how to continue"
                    : "Limited trial"}
                </h2>
                <Badge>{TRIAL_DAYS} days</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-400">
                Everything in Pro for {TRIAL_DAYS} more days — one-time, no mandate, no
                auto-renewal.{" "}
                {discount ? (
                  <span className="text-emerald-400">
                    {discount.percentOff}% off: {formatINR(applyCouponToBase(TRIAL_PRICE_PAISE, discount.percentOff))}
                  </span>
                ) : (
                  <>{formatINR(TRIAL_PRICE_PAISE)}</>
                )}{" "}
                + {GST_PERCENT}% GST ={" "}
                <span className="font-semibold text-ink-100">
                  {formatINR(withGst(discount ? applyCouponToBase(TRIAL_PRICE_PAISE, discount.percentOff) : TRIAL_PRICE_PAISE))}
                </span>
                .
              </p>
            </div>
            <Button disabled={loadingTier !== null} onClick={startTrial}>
              {loadingTier === "TRIAL"
                ? "Opening checkout…"
                : `Pay ${formatINR(withGst(discount ? applyCouponToBase(TRIAL_PRICE_PAISE, discount.percentOff) : TRIAL_PRICE_PAISE))}`}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-8 grid gap-6">
        {(["PRO"] as const).map((tier) => {
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
              <p className="text-xs text-ink-400">
                {formatINR(withGst(plan.pricePaise))}/mo incl. {GST_PERCENT}% GST
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
                disabled={loadingTier !== null || status?.planTier === tier}
                onClick={() => subscribe(tier)}
              >
                {loadingTier === tier
                  ? "Opening checkout…"
                  : status?.planTier === tier
                    ? "Current plan"
                    : status && status.planTier !== "FREE"
                      ? `Switch to ${plan.name}`
                      : `Subscribe to ${plan.name}`}
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
              <p className="mt-2 font-semibold">
                {discount ? (
                  <>
                    <span className="text-ink-500 line-through">{formatINR(pack.pricePaise)}</span>{" "}
                    <span className="text-emerald-400">{formatINR(applyCouponToBase(pack.pricePaise, discount.percentOff))}</span>
                  </>
                ) : (
                  formatINR(pack.pricePaise)
                )}
              </p>
              <p className="text-xs text-ink-400">
                + {GST_PERCENT}% GST ={" "}
                {formatINR(withGst(discount ? applyCouponToBase(pack.pricePaise, discount.percentOff) : pack.pricePaise))}
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
        No revenue share, no hidden charges — everything your business earns is 100% yours.
      </p>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

      <DeleteCompany slug={slug} name={slug} />
    </div>
  );
}
