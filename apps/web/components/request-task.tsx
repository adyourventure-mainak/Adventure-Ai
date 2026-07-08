"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";

export function RequestTask({ slug }: { slug: string }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [agent, setAgent] = useState<"ENGINEER" | "SOCIAL">("ENGINEER");
  const [withImage, setWithImage] = useState(true);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const res = await fetch(`/api/companies/${slug}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction, agent, withImage: agent === "SOCIAL" && withImage }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setState("idle");
      return;
    }
    setInstruction("");
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
            Queued — the draft lands in Approvals for your sign-off.
          </span>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}
