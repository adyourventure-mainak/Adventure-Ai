"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";

type Redemption = { id: string; companyId: string; appliedTo: string; createdAt: string };
type Coupon = {
  id: string;
  code: string;
  percentOff: number;
  freeDays: number;
  note: string | null;
  allowedEmail: string | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  active: boolean;
  expiresAt: string | null;
  redemptions: Redemption[];
};

export function CouponsAdmin() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState<50 | 70 | 100>(100);
  const [freeDays, setFreeDays] = useState(30);
  const [note, setNote] = useState("");
  const [allowedEmail, setAllowedEmail] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/coupons");
    const data = await res.json();
    if (res.ok) setCoupons(data.coupons);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        percentOff: percent,
        freeDays,
        note: note || undefined,
        allowedEmail: allowedEmail || undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setErr(data.error ?? "Failed");
    setCode(""); setNote(""); setAllowedEmail(""); setMaxRedemptions("");
    void load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/coupons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) void load();
    else setErr((await res.json()).error ?? "Failed");
  }

  return (
    <Card>
      <h2 className="font-semibold">Coupons</h2>
      <p className="mt-1 text-sm text-ink-400">
        Create codes for specific users. 100% = free {freeDays}-day full access; 50%/70% off the
        ₹499 trial &amp; credit packs. Codes are case-insensitive.
      </p>

      <form onSubmit={create} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Input placeholder="CODE (e.g. WELCOME100)" value={code} onChange={(e) => setCode(e.target.value)} />
        <select
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value) as 50 | 70 | 100)}
          className="rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm"
        >
          <option value={100}>100% — free plan</option>
          <option value={70}>70% off</option>
          <option value={50}>50% off</option>
        </select>
        {percent === 100 ? (
          <Input type="number" placeholder="Free days" value={freeDays} onChange={(e) => setFreeDays(Number(e.target.value))} />
        ) : (
          <div />
        )}
        <Input placeholder="Restrict to email (optional)" value={allowedEmail} onChange={(e) => setAllowedEmail(e.target.value)} />
        <Input type="number" placeholder="Max redemptions (blank = ∞)" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
        <Input placeholder="Internal note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="sm:col-span-2 lg:col-span-3">
          <Button disabled={saving || code.trim().length < 3}>{saving ? "Creating…" : "Create coupon"}</Button>
          {err && <span className="ml-3 text-sm text-red-400">{err}</span>}
        </div>
      </form>

      <div className="mt-6 space-y-2">
        {loading ? (
          <p className="text-sm text-ink-400">Loading…</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-ink-400">No coupons yet.</p>
        ) : (
          coupons.map((c) => (
            <div key={c.id} className="rounded-lg border border-ink-800 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-ink-800 px-2 py-0.5 font-semibold">{c.code}</code>
                <Badge variant="outline">{c.percentOff === 100 ? `free ${c.freeDays}d` : `${c.percentOff}% off`}</Badge>
                <Badge variant={c.active ? "success" : "outline"}>{c.active ? "active" : "off"}</Badge>
                <span className="text-ink-400">
                  used {c.redemptionCount}
                  {c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}
                </span>
                {c.allowedEmail && <span className="text-ink-400">· for {c.allowedEmail}</span>}
                {c.note && <span className="text-ink-500">· {c.note}</span>}
                <button
                  onClick={() => patch(c.id, { active: !c.active })}
                  className="ml-auto rounded border border-ink-700 px-2 py-1 text-xs hover:border-brand-500"
                >
                  {c.active ? "Deactivate" : "Activate"}
                </button>
                <button
                  onClick={() => {
                    const next = prompt("New code (leave blank to keep):", c.code);
                    if (next && next.trim() && next.trim().toUpperCase() !== c.code) patch(c.id, { code: next.trim() });
                  }}
                  className="rounded border border-ink-700 px-2 py-1 text-xs hover:border-brand-500"
                >
                  Change code
                </button>
              </div>
              {c.redemptions.length > 0 && (
                <p className="mt-2 text-xs text-ink-400">
                  Redeemed by: {c.redemptions.map((r) => `${r.companyId.slice(-6)} (${r.appliedTo})`).join(", ")}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
