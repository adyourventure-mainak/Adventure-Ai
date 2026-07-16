"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FOUNDATION_STEPS } from "@adventure/core";
import { Button, Card, Textarea } from "@/components/ui";

// The generator streams one event per field it actually reaches; "saving" is
// the DB write that follows. No timers — every tick below is real progress.
const STEPS: { key: string; label: string }[] = [
  ...FOUNDATION_STEPS.map((s) => ({ key: s.key as string, label: s.label as string })),
  { key: "saving", label: "Setting up your dashboard" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneConsent, setPhoneConsent] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [socialConsent, setSocialConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  // Phone is optional; if given, it must start with a country code (+91…),
  // look valid, and have consent.
  const phoneOk =
    !phone.trim() ||
    (phone.trim().startsWith("+") && phone.replace(/\D/g, "").length >= 8 && phoneConsent);
  const [reached, setReached] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function create(surprise: boolean) {
    setLoading(true);
    setError(null);
    setReached([]);
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(surprise ? { surprise: true } : { idea }),
          location,
          phone,
          phoneConsent,
          instagramUrl,
          facebookUrl,
          youtubeUrl,
          linkedinUrl,
          socialConsent,
        }),
      });
      // Validation failures come back as plain JSON with a real status code.
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong");
      }
      if (!res.body) throw new Error("Something went wrong");

      // Progress stream: one event per field the model reaches, then the slug.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5).trim()) as {
            step?: string;
            done?: boolean;
            slug?: string;
            error?: string;
          };
          if (evt.error) throw new Error(evt.error);
          if (evt.step) setReached((r) => (r.includes(evt.step!) ? r : [...r, evt.step!]));
          if (evt.done && evt.slug) {
            router.push(`/c/${evt.slug}/design`);
            return; // keep the loading view up through navigation
          }
        }
      }
      throw new Error("The connection dropped before your company was ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (loading) {
    // A step is "current" once reached and nothing after it has arrived yet.
    const currentIdx = reached.length - 1;
    return (
      <Card className="mx-auto mt-16 max-w-lg py-12">
        <div className="text-center">
          <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-ink-600 border-t-brand-500" />
          <h2 className="text-lg font-semibold">Founding your company…</h2>
          <p className="mt-2 text-sm text-ink-400">
            {location.trim()
              ? `Building it for ${location.trim()} — this takes under a minute.`
              : "This takes under a minute."}
          </p>
        </div>
        <ul className="mx-auto mt-8 max-w-xs space-y-2.5">
          {STEPS.map((s, i) => {
            const done = i < currentIdx;
            const current = i === currentIdx;
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 text-sm transition-colors ${
                  done ? "text-ink-400" : current ? "text-white" : "text-ink-600"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {done ? (
                    <span className="text-brand-400">✓</span>
                  ) : current ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-800" />
                  )}
                </span>
                {s.label}
              </li>
            );
          })}
        </ul>
        {reached.length === 0 && (
          <p className="mt-6 text-center text-xs text-ink-600">Thinking through your idea…</p>
        )}
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
          <label htmlFor="location" className="text-sm font-medium text-ink-100">
            Where do you operate? <span className="text-ink-400">(optional)</span>
          </label>
          <input
            id="location"
            type="text"
            placeholder="e.g. Durgapur, West Bengal"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            maxLength={120}
            className="mt-1 w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-400">
            Your AI co-founder uses this to ground the idea in what actually sells there — local
            demand, proven categories, seasonality and channels — and to write copy that ranks
            locally. Leave blank for a location-neutral online business.
          </p>
        </div>
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
            Your website gets a &quot;Call now&quot; button and a WhatsApp chat button so customers
            can reach you (the number is publicly visible there). Must start with your country
            code, e.g. <span className="text-ink-100">+91</span>.
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
          <Button
            className="flex-1"
            disabled={idea.trim().length < 10 || !phoneOk}
            onClick={() => create(false)}
          >
            Build this idea
          </Button>
          <Button className="flex-1" variant="outline" disabled={!phoneOk} onClick={() => create(true)}>
            🎲 Surprise me
          </Button>
        </div>
        {idea.trim().length > 0 && idea.trim().length < 10 && (
          <p className="mt-2 text-xs text-ink-400">
            Describe the idea in a short sentence (at least 10 characters) — e.g.{" "}
            <button
              type="button"
              className="underline hover:text-white"
              onClick={() => setIdea("Eco-friendly packaging solutions for small businesses")}
            >
              &quot;Eco-friendly packaging solutions for small businesses&quot;
            </button>
            . The AI builds your whole company from it, so a little detail goes a long way.
          </p>
        )}
        {!phoneOk && (
          <p className="mt-2 text-xs text-ink-400">
            Finish the WhatsApp number — it must start with the country code (e.g. +91) — and
            tick its consent box, or clear the field to skip the Call &amp; WhatsApp buttons.
          </p>
        )}
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </Card>

      <p className="mt-4 text-xs text-ink-400">
        Your first company starts with a 3-day free trial — agents on, website deployed,
        everything unlocked. After that (and for any further companies), continue with the ₹499
        7-day trial or the ₹999/mo Pro plan.
      </p>
    </div>
  );
}
