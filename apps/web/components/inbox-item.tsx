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

export function InboxItem({ item }: { item: InboxDeliverable }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(shareText(item));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
      </div>
    </div>
  );
}
