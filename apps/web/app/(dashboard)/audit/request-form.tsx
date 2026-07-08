"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

export function AuditRequestForm() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteUrl: websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`,
          businessName: businessName || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      router.push(`/audit/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-ink-400 focus:border-brand-500 focus:outline-none";

  return (
    <Card>
      <h2 className="font-semibold">Request an audit</h2>
      <p className="mt-1 text-sm text-ink-400">
        Enter your business website. A senior-marketing-executive-grade report is generated in
        about a minute — grounded in your own site's content.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <input
          required
          type="text"
          placeholder="yourbusiness.com"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className={inputClass}
        />
        <input
          type="text"
          placeholder="Business name (optional)"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className={inputClass}
        />
        <textarea
          placeholder="Tell us about your products or services, current customers, and goals (optional but improves the report)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className={inputClass}
        />
        <Button type="submit" disabled={loading || !websiteUrl}>
          {loading ? "Researching your business… (~1 min)" : "Generate audit"}
        </Button>
        <p className="text-xs text-ink-400">
          Your website's public content is processed by AI to produce this report, per our{" "}
          <a href="/privacy" className="underline hover:text-white" target="_blank">Privacy Policy</a>.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </Card>
  );
}
