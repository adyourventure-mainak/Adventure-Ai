"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

type Review = { author: string; rating: number; text: string };

export function GmbReviews({
  slug,
  initialGmbUrl,
  initialReviews,
}: {
  slug: string;
  initialGmbUrl: string | null;
  initialReviews: Review[];
}) {
  const router = useRouter();
  const [gmbUrl, setGmbUrl] = useState(initialGmbUrl ?? "");
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [state, setState] = useState<"idle" | "scanning" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("scanning");
    setError(null);
    const res = await fetch(`/api/companies/${slug}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gmbUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setState("idle");
      return;
    }
    setReviews(data.reviews);
    setState("done");
    router.refresh();
    setTimeout(() => setState("idle"), 5000);
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          placeholder="Google Business link — e.g. maps.app.goo.gl/…"
          value={gmbUrl}
          onChange={(e) => setGmbUrl(e.target.value)}
          maxLength={500}
          className="max-w-md"
        />
        <Button disabled={state === "scanning" || gmbUrl.trim().length < 5}>
          {state === "scanning" ? "Scanning…" : reviews.length ? "Re-scan reviews" : "Fetch top reviews"}
        </Button>
        {state === "done" && (
          <span className="text-sm text-emerald-400">
            Got {reviews.length} review{reviews.length === 1 ? "" : "s"} — adding to your website.
          </span>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </form>
      {reviews.length > 0 && (
        <ul className="mt-4 space-y-3">
          {reviews.map((r, i) => (
            <li key={i} className="rounded-lg border border-ink-800 p-3 text-sm">
              <span className="text-amber-400">{"★".repeat(Math.round(r.rating))}</span>
              <span className="ml-2 font-medium text-ink-100">{r.author}</span>
              <p className="mt-1 text-ink-400">{r.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
