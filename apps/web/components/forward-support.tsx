"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@/components/ui";

export function ForwardSupport({ slug }: { slug: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const res = await fetch(`/api/companies/${slug}/support`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, customerEmail }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      setState("idle");
      return;
    }
    setMessage("");
    setCustomerEmail("");
    setState("sent");
    router.refresh();
    setTimeout(() => setState("idle"), 4000);
  }

  return (
    <form onSubmit={submit}>
      <Textarea
        placeholder='Paste a customer question, e.g. "Do you ship outside India? What does the Pro plan include?"'
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={4000}
        className="min-h-[80px]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Input
          type="email"
          placeholder="Customer email (optional)"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
          className="max-w-xs"
        />
        <Button disabled={state === "sending" || message.trim().length < 5}>
          {state === "sending" ? "Forwarding…" : "Ask Support agent"}
        </Button>
        {state === "sent" && (
          <span className="text-sm text-emerald-400">Forwarded — the reply lands in tasks.</span>
        )}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </form>
  );
}
