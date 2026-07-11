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
  const [phone, setPhone] = useState("");
  const [phoneConsent, setPhoneConsent] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [socialConsent, setSocialConsent] = useState(false);
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
        body: JSON.stringify({
          ...(surprise ? { surprise: true } : { idea }),
          phone,
          phoneConsent,
          instagramUrl,
          facebookUrl,
          youtubeUrl,
          linkedinUrl,
          socialConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(`/c/${data.slug}/design`);
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
        <div className="mt-4">
          <label htmlFor="phone" className="text-sm font-medium text-ink-100">
            WhatsApp number <span className="text-ink-400">(optional)</span>
          </label>
          <input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
            className="mt-1 w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-400">
            Adds a WhatsApp chat button to your company's website (it will be publicly visible
            there). Include the country code.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs text-ink-400">
            <input
              type="checkbox"
              checked={phoneConsent}
              onChange={(e) => setPhoneConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I consent to Adventure AI storing this number and displaying it on my company
              website, as described in the{" "}
              <a href="/privacy" className="underline hover:text-white" target="_blank">
                Privacy Policy
              </a>
              . You can withdraw consent anytime by deleting your account.
            </span>
          </label>
        </div>
        <div className="mt-4">
          <span className="text-sm font-medium text-ink-100">
            Social profiles <span className="text-ink-400">(optional)</span>
          </span>
          <p className="mt-1 text-xs text-ink-400">
            Just the account name — we build the links for you (e.g. type{" "}
            <span className="text-ink-100">@yourbrand</span>). Your company website will link to
            them. Leave blank to keep the site without social links.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              type="text"
              placeholder="Instagram — @username"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              maxLength={300}
              className="w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Facebook — page name"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              maxLength={300}
              className="w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="YouTube — @channel"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              maxLength={300}
              className="w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="LinkedIn — company name"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              maxLength={300}
              className="w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
            />
          </div>
          {(instagramUrl.trim() || facebookUrl.trim() || youtubeUrl.trim() || linkedinUrl.trim()) && (
            <label className="mt-2 flex items-start gap-2 text-xs text-ink-400">
              <input
                type="checkbox"
                checked={socialConsent}
                onChange={(e) => setSocialConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I consent to Adventure AI storing these links and displaying them on my company
                website, as described in the{" "}
                <a href="/privacy" className="underline hover:text-white" target="_blank">
                  Privacy Policy
                </a>
                . You can withdraw consent anytime by removing the links or deleting your account.
              </span>
            </label>
          )}
        </div>
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
        Your company starts with a 2-day free trial — agents on, website deployed, everything
        unlocked. After that, continue with the 7-day limited trial or Pro.
      </p>
    </div>
  );
}
