"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";

export function RequestTask({ slug }: { slug: string }) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const res = await fetch(`/api/companies/${slug}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
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

  return (
    <form onSubmit={submit}>
      <Textarea
        placeholder='Ask the Engineer for a change, e.g. "Make the headline focus on saving time, and add an FAQ about pricing"'
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        maxLength={2000}
        className="min-h-[80px]"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button disabled={state === "sending" || instruction.trim().length < 10}>
          {state === "sending" ? "Queuing…" : "Send to Engineer (1 credit)"}
        </Button>
        {state === "sent" && (
          <span className="text-sm text-emerald-400">Queued — watch the activity feed.</span>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}
