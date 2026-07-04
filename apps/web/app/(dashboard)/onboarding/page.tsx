"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Textarea } from "@/components/ui";

const LOADING_STEPS = [
  "Validating the niche…",
  "Naming your company…",
  "Writing positioning & brand voice…",
  "Drafting landing page copy…",
  "Building your 30-day plan…",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function create(surprise: boolean) {
    setLoading(true);
    setError(null);
    const ticker = setInterval(
      () => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      4000,
    );
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(surprise ? { surprise: true } : { idea }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(`/c/${data.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    } finally {
      clearInterval(ticker);
    }
  }

  if (loading) {
    return (
      <Card className="mx-auto mt-16 max-w-lg py-16 text-center">
        <div className="mx-auto mb-6 h-10 w-10 animate-spin rounded-full border-2 border-ink-600 border-t-brand-500" />
        <h2 className="text-lg font-semibold">Founding your company…</h2>
        <p className="mt-2 text-sm text-ink-400">{LOADING_STEPS[step]}</p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">What should your AI co-founder build?</h1>
      <p className="mt-2 text-sm text-ink-400">
        Describe a business idea in a sentence or two — or let the AI invent a validated niche
        idea for you.
      </p>

      <Card className="mt-8">
        <Textarea
          placeholder="e.g. A subscription service that sends personalized weekly meal plans for people with PCOS…"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          maxLength={2000}
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button className="flex-1" disabled={idea.trim().length < 10} onClick={() => create(false)}>
            Build this idea
          </Button>
          <Button className="flex-1" variant="outline" onClick={() => create(true)}>
            🎲 Surprise me
          </Button>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </Card>

      <p className="mt-4 text-xs text-ink-400">
        Free plan: idea, positioning, landing page preview, and a 30-day plan. Upgrade to Pro to
        deploy it and switch the agents on.
      </p>
    </div>
  );
}
