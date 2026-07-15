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
  platform?: string; // the network the Social agent wrote this for
  extra?: { label: string; value: string }[]; // subject, audience, targeting…
}

/** The company's own profile links, so "post it" lands on their page. */
export interface CompanySocials {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
}

function shareText(item: InboxDeliverable): string {
  const tags = item.hashtags?.length ? "\n\n" + item.hashtags.map((h) => `#${h}`).join(" ") : "";
  const img = item.imageUrl ? `\n\n${item.imageUrl}` : "";
  return `${item.text}${tags}${img}`;
}

/** Caption only — composers take the image separately, so no URL noise. */
function caption(item: InboxDeliverable): string {
  const tags = item.hashtags?.length ? "\n\n" + item.hashtags.map((h) => `#${h}`).join(" ") : "";
  return `${item.text}${tags}`;
}

type Target = {
  key: string;
  label: string;
  href: string;
  /** Whether the network actually accepts a prefilled caption over a URL. */
  prefills: boolean;
  className: string;
};

/**
 * Where a post can be taken to be published. Only X and LinkedIn accept a
 * prefilled caption via URL; Instagram has no web composer intent at all and
 * Facebook ignores prefilled text, so for those we put the caption on the
 * clipboard and open the company's own page to paste into.
 */
function targetsFor(item: InboxDeliverable, socials: CompanySocials): Target[] {
  const text = encodeURIComponent(caption(item));
  const all: Target[] = [
    {
      key: "twitter",
      label: "Post on X",
      href: `https://twitter.com/intent/tweet?text=${text}`,
      prefills: true,
      className: "bg-white text-black",
    },
    {
      key: "linkedin",
      label: "Post on LinkedIn",
      href: `https://www.linkedin.com/feed/?shareActive=true&text=${text}`,
      prefills: true,
      className: "bg-[#0A66C2] text-white",
    },
    {
      key: "instagram",
      label: "Post on Instagram",
      href: socials.instagramUrl || "https://www.instagram.com/",
      prefills: false,
      className: "bg-[#E1306C] text-white",
    },
    {
      key: "facebook",
      label: "Post on Facebook",
      href: socials.facebookUrl || "https://www.facebook.com/",
      prefills: false,
      className: "bg-[#1877F2] text-white",
    },
  ];
  const linked = new Set(
    [
      socials.instagramUrl ? "instagram" : null,
      socials.facebookUrl ? "facebook" : null,
      socials.linkedinUrl ? "linkedin" : null,
    ].filter(Boolean) as string[],
  );
  // Social's schema emits exactly: twitter | linkedin | instagram | facebook.
  const written = item.platform?.toLowerCase();
  // Show the network this post was written for, plus any the company linked.
  const show = all.filter((t) => t.key === written || linked.has(t.key));
  return show.length > 0 ? show : all.filter((t) => t.key === "twitter");
}

export function InboxItem({
  slug,
  item,
  socials = {},
}: {
  slug: string;
  item: InboxDeliverable;
  socials?: CompanySocials;
}) {
  const [copied, setCopied] = useState(false);
  const [pasteReady, setPasteReady] = useState<string | null>(null);
  const [rated, setRated] = useState<"up" | "down" | null>(null);
  const [note, setNote] = useState("");
  const [askNote, setAskNote] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(shareText(item));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Networks that can't take a prefilled caption still shouldn't mean retyping
  // it — put it on the clipboard on the way out, so the tab opens paste-ready.
  async function openTarget(t: Target) {
    if (!t.prefills) {
      await navigator.clipboard.writeText(caption(item)).catch(() => {});
      setPasteReady(t.label);
      setTimeout(() => setPasteReady(null), 6000);
    }
    window.open(t.href, "_blank", "noopener,noreferrer");
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
        {item.kind === "Social post" &&
          targetsFor(item, socials).map((t) => (
            <button
              key={t.key}
              onClick={() => openTarget(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold hover:opacity-90 ${t.className}`}
              title={
                t.prefills
                  ? "Opens the composer with your caption filled in — you press post"
                  : "Copies your caption and opens your page — paste it in and attach the image"
              }
            >
              {t.label} ↗
            </button>
          ))}
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
      {pasteReady && (
        <p className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/10 px-3 py-2 text-xs text-brand-400">
          Caption copied — paste it into {pasteReady}
          {item.imageUrl ? ", and attach the image you downloaded" : ""}. {pasteReady} doesn&apos;t
          let apps prefill a post, so this last step is yours.
        </p>
      )}
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
