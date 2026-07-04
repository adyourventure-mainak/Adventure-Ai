"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function AdminActions({
  companyId,
  status,
  adBudgetCapRupees,
  routeAccountId,
}: {
  companyId: string;
  status: string;
  adBudgetCapRupees: number;
  routeAccountId: string | null;
}) {
  const router = useRouter();
  const [adCap, setAdCap] = useState(String(adBudgetCapRupees));
  const [account, setAccount] = useState(routeAccountId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/companies/${companyId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed");
    } else {
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "ACTIVE" && (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => post({ action: "pause" })}>
          Pause
        </Button>
      )}
      {status === "PAUSED" && (
        <Button size="sm" disabled={busy} onClick={() => post({ action: "resume" })}>
          Resume
        </Button>
      )}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          value={adCap}
          onChange={(e) => setAdCap(e.target.value)}
          className="h-8 w-24 text-xs"
          title="Monthly ad budget cap (₹)"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || adCap === String(adBudgetCapRupees)}
          onClick={() => post({ action: "setAdCap", adBudgetCapRupees: parseInt(adCap || "0", 10) })}
        >
          Set ₹cap
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <Input
          placeholder="acc_… (Route)"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          className="h-8 w-40 text-xs"
          title="Razorpay Route linked account id"
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={busy || !account.startsWith("acc_") || account === routeAccountId}
          onClick={() => post({ action: "setRouteAccount", accountId: account })}
        >
          Link
        </Button>
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
