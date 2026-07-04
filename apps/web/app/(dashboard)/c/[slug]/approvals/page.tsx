import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@adventure/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { ApprovalCard, type ApprovalItem } from "@/components/approval-card";

export const dynamic = "force-dynamic";

const DECIDED_BADGE: Record<string, { label: string; variant: "success" | "outline" | "default" }> = {
  APPROVED: { label: "approved", variant: "success" },
  EDITED_AND_APPROVED: { label: "approved with edits", variant: "success" },
  REJECTED: { label: "rejected", variant: "default" },
  EXPIRED: { label: "expired", variant: "outline" },
};

export default async function ApprovalsPage({ params }: { params: { slug: string } }) {
  const user = await requireUser();
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: {
      id: true,
      name: true,
      slug: true,
      ownerId: true,
      approvals: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { task: { select: { title: true, agent: true } } },
      },
    },
  });
  if (!company || company.ownerId !== user.id) notFound();

  const pending = company.approvals.filter((a) => a.status === "PENDING");
  const decided = company.approvals.filter((a) => a.status !== "PENDING").slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/c/${company.slug}`} className="text-sm text-brand-400 hover:underline">
          ← {company.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Approvals inbox</h1>
        <p className="mt-1 text-sm text-ink-400">
          Nothing outbound ships without you. Approve as-is, edit first, or reject — your edit is
          what actually goes out.
        </p>
      </div>

      {pending.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-400">
            Inbox zero — your agents will drop new drafts here as they work.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {pending.map((a) => (
            <ApprovalCard
              key={a.id}
              slug={company.slug}
              item={
                {
                  id: a.id,
                  kind: a.kind,
                  agent: a.task.agent,
                  taskTitle: a.task.title,
                  createdAt: a.createdAt.toISOString(),
                  draft: a.draft as Record<string, unknown>,
                } satisfies ApprovalItem
              }
            />
          ))}
        </div>
      )}

      {decided.length > 0 && (
        <Card>
          <h2 className="font-semibold">Recently decided</h2>
          <ul className="mt-3 space-y-2">
            {decided.map((a) => {
              const badge = DECIDED_BADGE[a.status] ?? { label: a.status, variant: "outline" as const };
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-ink-100">{a.task.title}</span>
                  <Badge
                    variant={badge.variant}
                    className={a.status === "REJECTED" ? "bg-red-500/15 text-red-400" : ""}
                  >
                    {badge.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
