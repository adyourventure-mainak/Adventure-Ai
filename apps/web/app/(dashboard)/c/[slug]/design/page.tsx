"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

const MAX_SUGGESTIONS = 5;
const MAX_IMAGES = 5;

export default function DesignBriefPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<string[]>([""]);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setSuggestion(i: number, v: string) {
    setSuggestions((prev) => prev.map((s, j) => (j === i ? v : s)));
  }

  async function submit() {
    const cleaned = suggestions.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0 && files.length === 0) {
      setError("Add at least one suggestion or image — or skip this step.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let imageUrls: string[] = [];
      if (files.length > 0) {
        const form = new FormData();
        files.slice(0, MAX_IMAGES).forEach((f) => form.append("files", f));
        const up = await fetch(`/api/companies/${slug}/uploads`, { method: "POST", body: form });
        const upData = await up.json();
        if (!up.ok) throw new Error(upData.error ?? "Image upload failed");
        imageUrls = upData.urls;
      }
      const res = await fetch(`/api/companies/${slug}/design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestions: cleaned, imageUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      router.push(`/c/${slug}?design=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">How should your website look?</h1>
      <p className="mt-2 text-sm text-ink-400">
        Your company is founded and the site is being built. Tell the Engineer how you want it —
        colours, sections, tone, anything — and it will follow your suggestions. Optional; you can
        always ask for changes later.
      </p>

      <Card className="mt-8">
        <h2 className="text-sm font-semibold">
          Design suggestions <span className="font-normal text-ink-400">(up to {MAX_SUGGESTIONS}, optional)</span>
        </h2>
        <div className="mt-3 space-y-3">
          {suggestions.map((s, i) => (
            <input
              key={i}
              value={s}
              onChange={(e) => setSuggestion(i, e.target.value)}
              maxLength={300}
              placeholder={
                [
                  "e.g. Use a deep green colour theme with cream background",
                  "e.g. Add a section about our story",
                  "e.g. Keep it minimal — lots of whitespace",
                  "e.g. Make the headline about saving time",
                  "e.g. Friendly, conversational tone",
                ][i] ?? "Another suggestion"
              }
              className="w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-600 focus:border-brand-500 focus:outline-none"
            />
          ))}
        </div>
        {suggestions.length < MAX_SUGGESTIONS && (
          <button
            onClick={() => setSuggestions((p) => [...p, ""])}
            className="mt-3 text-sm text-brand-400 hover:underline"
          >
            + Add another suggestion
          </button>
        )}

        <h2 className="mt-8 text-sm font-semibold">
          Images for your website <span className="font-normal text-ink-400">(up to {MAX_IMAGES}, optional)</span>
        </h2>
        <p className="mt-1 text-xs text-ink-400">
          Product photos, your shop, your team — the first image leads the homepage, the rest form
          a gallery. JPG/PNG, max 5 MB each.
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_IMAGES))}
          className="mt-3 block w-full text-sm text-ink-400 file:mr-4 file:rounded-lg file:border-0 file:bg-ink-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-ink-600"
        />
        {files.length > 0 && (
          <p className="mt-2 text-xs text-ink-400">{files.map((f) => f.name).join(" · ")}</p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button disabled={busy} onClick={submit}>
            {busy ? "Sending to your Engineer…" : "Build my website this way"}
          </Button>
          <Link href={`/c/${slug}`} className="text-sm text-ink-400 hover:text-white">
            Skip — let the AI decide
          </Link>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </Card>
    </div>
  );
}
