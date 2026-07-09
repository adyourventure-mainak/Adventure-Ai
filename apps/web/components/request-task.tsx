"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";

export function RequestTask({ slug }: { slug: string }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [agent, setAgent] = useState<"ENGINEER" | "SOCIAL">("ENGINEER");
  const [withImage, setWithImage] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    // Engineer tasks can carry owner images (site photos, product shots).
    let imageUrls: string[] = [];
    if (agent === "ENGINEER" && files.length > 0) {
      const form = new FormData();
      files.slice(0, 5).forEach((f) => form.append("files", f));
      const up = await fetch(`/api/companies/${slug}/uploads`, { method: "POST", body: form });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok) {
        setError(upData.error ?? "Image upload failed");
        setState("idle");
        return;
      }
      imageUrls = upData.urls;
    }
    const res = await fetch(`/api/companies/${slug}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction, agent, withImage: agent === "SOCIAL" && withImage, imageUrls }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setState("idle");
      return;
    }
    setInstruction("");
    setFiles([]);
    setState("sent");
    router.refresh();
    setTimeout(() => setState("idle"), 4000);
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${active ? "bg-brand-500 text-white" : "border border-ink-800 text-ink-400 hover:text-white"}`;

  return (
    <form onSubmit={submit}>
      <div className="mb-3 flex items-center gap-2">
        <button type="button" className={tabClass(agent === "ENGINEER")} onClick={() => setAgent("ENGINEER")}>
          Site change
        </button>
        <button type="button" className={tabClass(agent === "SOCIAL")} onClick={() => setAgent("SOCIAL")}>
          Social post
        </button>
      </div>
      <Textarea
        placeholder={
          agent === "ENGINEER"
            ? 'Ask the Engineer for a change, e.g. "Make the headline focus on saving time, and add an FAQ about pricing"'
            : 'Describe the post, e.g. "Announce our festive 20% off on gift hampers, warm and personal tone"'
        }
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        maxLength={2000}
        className="min-h-[80px]"
      />
      {agent === "ENGINEER" && (
        <div className="mt-2">
          <label className="text-sm text-ink-400">
            Attach images for the website (optional, up to 5 — e.g. product photos to add or replace)
          </label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
            className="mt-1 block w-full text-sm text-ink-400 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-800 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-ink-600"
          />
          {files.length > 0 && (
            <p className="mt-1 text-xs text-ink-400">{files.map((f) => f.name).join(" · ")}</p>
          )}
        </div>
      )}
      {agent === "SOCIAL" && (
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-400">
          <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} />
          Generate an image for the post
        </label>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={state === "sending" || instruction.trim().length < 10}>
          {state === "sending"
            ? "Queuing…"
            : agent === "ENGINEER"
              ? "Send to Engineer (1 credit)"
              : "Send to Social agent (1 credit)"}
        </Button>
        {state === "sent" && (
          <span className="text-sm text-emerald-400">
            Queued — the result lands in your Inbox in a minute or two.
          </span>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}
