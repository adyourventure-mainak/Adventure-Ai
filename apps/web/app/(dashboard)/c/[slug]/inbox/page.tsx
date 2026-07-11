import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@adventure/db";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { InboxItem, type InboxDeliverable } from "@/components/inbox-item";

export const dynamic = "force-dynamic";

// Shapes written by the agents into Task.result.
type SocialResult = { post?: { text?: string; hashtags?: string[]; imageUrl?: string; platform?: string } };
type EmailResult = { email?: { audience?: string; subject?: string; body?: string } };
type SupportResult = { reply?: string };
type AdsResult = { campaign?: { platform?: string; headline?: string; description?: string; targeting?: string; dailyBudgetRupees?: number } };

export default async function InboxPage({ params }: { params: { slug: string } }) {
  const user = await requireUser();
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      plan: { select: { adPlan: true } },
      tasks: {
        where: {
          status: "COMPLETED",
          agent: { in: ["SOCIAL", "EMAIL_OUTREACH", "SUPPORT", "ADS"] },
        },
        orderBy: { completedAt: "desc" },
        take: 40,
        select: { id: true, agent: true, title: true, completedAt: true, result: true },
      },
    },
  });
  if (!company || company.ownerId !== user.id) notFound();

  // Opening the Inbox marks everything read — the dashboard tab goes back to white.
  await prisma.company.update({
    where: { id: company.id },
    data: { inboxSeenAt: new Date() },
  });

  const items: InboxDeliverable[] = [];
  for (const t of company.tasks) {
    const base = {
      id: t.id,
      title: t.title,
      completedAt: (t.completedAt ?? new Date()).toISOString(),
    };
    if (t.agent === "SOCIAL") {
      const post = (t.result as SocialResult | null)?.post;
      if (post?.text)
        items.push({
          ...base,
          kind: "Social post",
          text: post.text,
          imageUrl: post.imageUrl,
          hashtags: post.hashtags,
        });
    } else if (t.agent === "EMAIL_OUTREACH") {
      const email = (t.result as EmailResult | null)?.email;
      if (email?.body)
        items.push({
          ...base,
          kind: "Outreach email",
          text: email.body,
          extra: [
            ...(email.audience ? [{ label: "To", value: email.audience }] : []),
            ...(email.subject ? [{ label: "Subject", value: email.subject }] : []),
          ],
        });
    } else if (t.agent === "SUPPORT") {
      const reply = (t.result as SupportResult | null)?.reply;
      if (reply) items.push({ ...base, kind: "Support reply", text: reply });
    } else if (t.agent === "ADS") {
      const c = (t.result as AdsResult | null)?.campaign;
      if (c?.headline)
        items.push({
          ...base,
          kind: "Ad campaign",
          text: `${c.headline}\n\n${c.description ?? ""}`,
          extra: [
            ...(c.platform ? [{ label: "Platform", value: c.platform }] : []),
            ...(c.targeting ? [{ label: "Targeting", value: c.targeting }] : []),
            ...(c.dailyBudgetRupees ? [{ label: "Budget", value: `₹${c.dailyBudgetRupees}/day` }] : []),
          ],
        });
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/c/${company.slug}`} className="text-sm text-brand-400 hover:underline">
          ← {company.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Inbox</h1>
        <p className="mt-1 text-sm text-ink-400">
          Everything your agents produce lands here, ready to use — copy the text, download the
          image, or share it straight to WhatsApp.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-4 py-4">
        <Link href={`/c/${company.slug}/plan`} className="text-sm text-brand-400 hover:underline">
          ↗ 30-day launch plan{company.plan?.adPlan ? " & advertisement plan" : ""} — view and implement
        </Link>
      </Card>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-400">
            Nothing here yet — request a social post or site change from your company page, or
            wait for the daily cycle. Deliverables arrive within a couple of minutes.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <InboxItem key={item.id} slug={company.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
