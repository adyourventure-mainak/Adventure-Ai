"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Textarea } from "@/components/ui";

export interface BillingProfile {
  billingName: string | null;
  billingGstin: string | null;
  billingPhone: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
}

export function BillingProfileForm({ initial }: { initial: BillingProfile }) {
  const router = useRouter();
  const [f, setF] = useState({
    billingName: initial.billingName ?? "",
    billingGstin: initial.billingGstin ?? "",
    billingPhone: initial.billingPhone ?? "",
    billingAddress: initial.billingAddress ?? "",
    shippingAddress: initial.shippingAddress ?? "",
  });
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [sameAsBilling, setSameAsBilling] = useState(
    Boolean(initial.billingAddress && initial.billingAddress === initial.shippingAddress),
  );

  async function save() {
    if (!f.billingPhone.trim()) {
      setError("Contact number is required — include the country code, e.g. +91 98765 43210.");
      return;
    }
    setState("saving");
    setError(null);
    const payload = {
      ...f,
      shippingAddress: sameAsBilling ? f.billingAddress : f.shippingAddress,
    };
    const res = await fetch("/api/account/billing-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not save");
      setState("idle");
      return;
    }
    setState("saved");
    router.refresh();
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-400">
        These details appear on your GST tax invoices. Add your GSTIN to claim input credit; leave
        it blank if you don&apos;t have one.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-ink-100">Company / legal name</span>
          <Input
            className="mt-1"
            value={f.billingName}
            onChange={(e) => setF({ ...f, billingName: e.target.value })}
            placeholder="Acme Traders Pvt Ltd"
          />
        </label>
        <label className="text-sm">
          <span className="text-ink-100">GSTIN (optional)</span>
          <Input
            className="mt-1 uppercase"
            value={f.billingGstin}
            onChange={(e) => setF({ ...f, billingGstin: e.target.value })}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-ink-100">Contact number</span>
        <Input
          type="tel"
          required
          className="mt-1"
          value={f.billingPhone}
          onChange={(e) => setF({ ...f, billingPhone: e.target.value })}
          placeholder="+91 98765 43210"
        />
      </label>
      <label className="block text-sm">
        <span className="text-ink-100">Billing address</span>
        <Textarea
          className="mt-1"
          value={f.billingAddress}
          onChange={(e) => setF({ ...f, billingAddress: e.target.value })}
          placeholder="Street, city, state, PIN"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-400">
        <input
          type="checkbox"
          checked={sameAsBilling}
          onChange={(e) => setSameAsBilling(e.target.checked)}
        />
        Shipping address same as billing
      </label>
      {!sameAsBilling && (
        <label className="block text-sm">
          <span className="text-ink-100">Shipping address</span>
          <Textarea
            className="mt-1"
            value={f.shippingAddress}
            onChange={(e) => setF({ ...f, shippingAddress: e.target.value })}
            placeholder="Street, city, state, PIN"
          />
        </label>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Saving…" : state === "saved" ? "✓ Saved" : "Save billing details"}
        </Button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
