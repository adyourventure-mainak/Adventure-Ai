/**
 * Platform mailer — transactional email to company owners via Resend.
 * This is Adventure AI writing to its users (activity reminders, win-back),
 * distinct from the per-company outreach integration in outreach.ts.
 *
 * No-ops (returns false) when RESEND_API_KEY is unset so dev/staging never
 * accidentally emails anyone.
 */

const RESEND_URL = "https://api.resend.com/emails";

export function mailerConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendOwnerEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.MAIL_FROM ?? "Adventure AI <hello@adventure-ai.in>";
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [opts.to], subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed (${res.status}): ${await res.text()}`);
  }
  return true;
}

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "https://www.adventure-ai.in";

function layout(body: string): string {
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
${body}
<p style="margin-top:32px;font-size:12px;color:#888">Adventure AI — your AI-run company. You receive these updates as a company owner.</p>
</div>`;
}

/** Daily nudge: what the agents shipped + what the owner should do today. */
export function activityReminderEmail(input: {
  companyName: string;
  slug: string;
  briefExcerpt?: string | null;
  weekTitle?: string | null;
  weekTasks: string[];
  unreadCount: number;
}): { subject: string; html: string } {
  const url = `${appUrl()}/c/${input.slug}`;
  const tasksHtml = input.weekTasks.length
    ? `<p><strong>${input.weekTitle ? `This week — ${escapeHtml(input.weekTitle)}` : "Your next activities"}:</strong></p>
<ul>${input.weekTasks.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`
    : "";
  const inboxHtml = input.unreadCount
    ? `<p>📬 <strong>${input.unreadCount} new deliverable${input.unreadCount === 1 ? "" : "s"}</strong> waiting in your <a href="${url}/inbox">Inbox</a> — posts, emails and replies ready to use.</p>`
    : "";
  return {
    subject: `${input.companyName}: today's activities from your agents`,
    html: layout(`<h2 style="margin:0 0 12px">Keep ${escapeHtml(input.companyName)} moving</h2>
${input.briefExcerpt ? `<p>${escapeHtml(input.briefExcerpt)}</p>` : ""}
${inboxHtml}
${tasksHtml}
<p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open your dashboard</a></p>`),
  };
}

/** Weekly win-back after the subscription stops. */
export function winbackEmail(input: { companyName: string; slug: string }): {
  subject: string;
  html: string;
} {
  const url = `${appUrl()}/c/${input.slug}/billing`;
  return {
    subject: `${input.companyName} is paused — restart your agents`,
    html: layout(`<h2 style="margin:0 0 12px">${escapeHtml(input.companyName)} misses its team</h2>
<p>Your subscription has stopped, so your agents are paused: no daily briefs, no social posts, no outreach, and your growth plan is standing still.</p>
<p>Restart your subscription to put the company back to work and keep it properly optimised.</p>
<p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Restart subscription</a></p>`),
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
