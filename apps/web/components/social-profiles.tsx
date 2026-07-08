"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function SocialProfiles({
  slug,
  initialFacebook,
  initialInstagram,
}: {
  slug: string;
  initialFacebook: string | null;
  initialInstagram: string | null;
}) {
  const [facebookUrl, setFacebookUrl] = useState(initialFacebook ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initialInstagram ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    const res = await fetch(`/api/companies/${slug}/social`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facebookUrl, instagramUrl }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not save");
      setState("idle");
      return;
    }
    setState("saved");
    setTimeout(() => setState("idle"), 3000);
  }

  const inputClass =
    "w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-brand-500 focus:outline-none";

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-ink-400">Facebook page</label>
        <input
          type="text"
          placeholder="facebook.com/yourpage"
          value={facebookUrl}
          onChange={(e) => setFacebookUrl(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-ink-400">Instagram profile</label>
        <input
          type="text"
          placeholder="instagram.com/yourhandle"
          value={instagramUrl}
          onChange={(e) => setInstagramUrl(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : "Save profiles"}
        </Button>
        {state === "saved" && <span className="text-sm text-emerald-400">Saved.</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
      <p className="text-xs text-ink-400">
        The Social agent tailors posts to these profiles. Posts (with generated images) land in
        Approvals ready to publish.
      </p>
    </form>
  );
}
