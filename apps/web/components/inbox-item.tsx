"use client";

import { useState } from "react";
import { Badge } from "@/components/ui";

export interface InboxDeliverable {
  id: string;
  kind: string; // "Social post" | "Outreach email" | "Support reply" | "Ad campaign"
  title: string;
  completedAt: string;
  text: string; // the main copy-able body
  imageUrl?: string;
  hashtags?: string[];
  extra?: { label: string; value: string }[]; // subject, audience, targeting…
}

function shareText(item: InboxDeliverable): string {
  const tags = item.hashtags?.length ? "\n\n" + item.hashtags.map((h) => `#${h}`).join(" ") : "";
  const img = item.imageUrl ? `\n\n${item.imageUrl}` : "";
  return `${item.text}${tags}${img}`;
}

export function InboxItem({ slug, item }: { slug: string; item: InboxDeliverable }) {
  const [copied, setCopied] = useState(false);
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [note, setNote] = useState("");
  const [askNote, setAskNote] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(shareText(item));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Feedback loop: ratings become embedded memories the agents recall on
  // every future generation for this company.
  async function rate(rating: "up" | "down", withNote?: string) {
    setRated(rating);
    setAskNote(rating === "down" && !withNote);
    await fetch(`/api/companies/${slug}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: item.id, rating, ...(withNote ? { note: withNote } : {}) }),
    }).catch(() => {});
  }

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Badge>{item.kind}</Badge>
          <span className="text-xs text-ink-400">
            {new Date(item.completedAt).toLocaleString("en-IN")}
          </span>
        </div>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>

      <div className="mt-3 flex items-start gap-4">
        {item.imageUrl && (
          <div className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt="Post image"
              className="aspect-square w-32 rounded-lg border border-ink-800 object-cover"
            />
            <a
              href={`${item.imageUrl}?download=post-image.jpg`}
              className="mt-1 block text-center text-xs text-brand-400 hover:underline"
            >
              ⬇ Download image
            </a>
          </div>
        )}
        <div className="min-w-0 flex-1">
          {item.extra?.map((e) => (
            <p key={e.label} className="text-xs text-ink-400">
              <span className="font-semibold uppercase tracking-wide">{e.label}:</span> {e.value}
            </p>
          ))}
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-100">{item.text}</p>
          {item.hashtags && item.hashtags.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-2">
              {item.hashtags.map((h) => (
                <span
                  key={h}
                  className="rounded-full border border-ink-800 px-2 py-0.5 text-xs text-ink-400"
                >
                  #{h}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={copy}
          className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-100 hover:border-brand-500"
        >
          {copied ? "✓ Copied" : "⧉ Copy"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText(item))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
        >
          Share on WhatsApp
        </a>
        <span className="ml-auto flex items-center gap-2 text-xs text-ink-400">
          {rated ? (
            <span className="text-emerald-400">✓ Thanks — your agents will learn from this</span>
          ) : (
            <>
              Rate it:
              <button onClick={() => rate("up")} className="rounded-lg border border-ink-700 px-2 py-1 hover:border-emerald-500" aria-label="Good">
                👍
              </button>
              <button onClick={() => rate("down")} className="rounded-lg border border-ink-700 px-2 py-1 hover:border-red-500" aria-label="Bad">
                👎
              </button>
            </>
          )}
        </span>
      </div>
      {askNote && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="What was wrong? (optional — helps your agents improve)"
            className="min-w-[240px] flex-1 rounded-lg border border-ink-800 bg-ink-950 px-3 py-1.5 text-xs text-white placeholder:text-ink-600 focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={() => { setAskNote(false); if (note.trim()) void rate("down", note.trim()); }}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-100 hover:border-brand-500"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
