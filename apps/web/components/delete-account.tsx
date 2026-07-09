"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Deletion failed — please contact support.");
      }
      // Account is gone; drop the session and land on the marketing page.
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <Card className="mt-12 border-red-500/30">
      <h2 className="font-semibold text-red-400">Delete account</h2>
      <p className="mt-1 text-sm text-ink-400">
        Permanently deletes your account, all companies, agent output, and stored personal data
        (including your phone number), and cancels any active subscriptions. This cannot be
        undone. Your right to erasure under the DPDP Act.
      </p>
      {!open ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-red-500/40 text-red-400 hover:bg-red-500/10"
          onClick={() => setOpen(true)}
        >
          Delete my account…
        </Button>
      ) : (
        <div className="mt-4">
          <label className="text-sm text-ink-100">
            Type <strong>DELETE</strong> to confirm:
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="rounded-lg border border-ink-800 bg-ink-950 px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
              placeholder="DELETE"
            />
            <Button
              size="sm"
              className="bg-red-500 text-white hover:bg-red-600"
              disabled={confirmText !== "DELETE" || busy}
              onClick={deleteAccount}
            >
              {busy ? "Deleting…" : "Permanently delete everything"}
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </Card>
  );
}
