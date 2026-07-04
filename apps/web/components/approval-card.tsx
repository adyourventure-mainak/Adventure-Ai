"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Textarea } from "@/components/ui";

export interface ApprovalItem {
  id: string;
  kind: string;
  agent: string;
  taskTitle: string;
  createdAt: string;
  draft: Record<string, unknown>;
}

const KIND_LABEL: Record<string, string> = {
  SOCIAL_POST: "Social post",
  OUTBOUND_EMAIL: "Outbound email",
  AD_BUDGET_CHANGE: "Ad budget",
  CODE_DEPLOY: "Deploy",
  OTHER: "Approval",
};

// The one field the founder is most likely to want to touch per draft shape.
function editableField(draft: Record<string, unknown>): string | null {
  if (typeof draft.text === "string") return "text"; // social post
  if (typeof draft.body === "string") return "body"; // outreach email
  if (typeof draft.reply === "string") return "reply"; // support reply
  return null;
}

const HIDDEN_FIELDS = new Set(["customerFact"]);

export function ApprovalCard({ slug, item }: { slug: string; item: ApprovalItem }) {
  const router = useRouter();
  const field = editableField(item.draft);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState(field ? String(item.draft[field]) : "");
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setState("sending");
    setError(null);
    const changed = editing && field && edited !== String(item.draft[field]);
    const res = await fetch(`/api/companies/${slug}/approvals/${item.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        ...(decision === "approve" && changed
          ? { editedDraft: { ...item.draft, [field]: edited } }
          : {}),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong");
      setState("idle");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-ink-800 bg-ink-900 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge>{KIND_LABEL[item.kind] ?? item.kind}</Badge>
          <span className="text-xs text-ink-400">
            {item.agent} · {new Date(item.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
      <h3 className="mt-3 font-semibold">{item.taskTitle}</h3>

      <dl className="mt-4 space-y-3 text-sm">
        {Object.entries(item.draft)
          .filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v !== "" && v != null)
          .map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{k}</dt>
              {editing && k === field ? (
                <Textarea
                  className="mt-1 min-h-[120px]"
                  value={edited}
                  onChange={(e) => setEdited(e.target.value)}
                />
              ) : (
                <dd className="mt-1 whitespace-pre-wrap text-ink-100">
                  {Array.isArray(v) ? v.map(String).join(", ") : String(v)}
                </dd>
              )}
            </div>
          ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={state === "sending"} onClick={() => decide("approve")}>
          {editing ? "Approve with edits" : "Approve"}
        </Button>
        {field && !editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit first
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-red-400 hover:bg-red-500/10"
          disabled={state === "sending"}
          onClick={() => decide("reject")}
        >
          Reject
        </Button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
