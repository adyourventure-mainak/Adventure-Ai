import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@adventure/db";
import { formatINR } from "@adventure/core";
import { requireUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { AdminActions } from "@/components/admin-actions";
import { CouponsAdmin } from "@/components/coupons-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();
  if (!user.isAdmin) notFound();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [companies, creditSums, llmMonth, pendingApprovals, failedWebhooks] = await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { email: true } },
        subscription: { select: { status: true, planTier: true } },
        integrations: { where: { provider: "RAZORPAY_ROUTE" }, select: { meta: true, status: true } },
        _count: { select: { tasks: true } },
      },
    }),
    prisma.creditLedgerEntry.groupBy({ by: ["companyId"], _sum: { delta: true } }),
    prisma.llmUsageDay.groupBy({
      by: ["companyId"],
      where: { date: { gte: monthStart } },
      _sum: { costP: true, inputTokens: true, outputTokens: true },
    }),
    prisma.approval.groupBy({
      by: ["companyId"],
      where: { status: "PENDING" },
      _count: { _all: true },
    }),
    prisma.webhookEvent.count({ where: { error: { not: null } } }),
  ]);

  const credits = new Map(creditSums.map((c) => [c.companyId, c._sum.delta ?? 0]));
  const llm = new Map(llmMonth.map((l) => [l.companyId, l._sum]));
  const approvals = new Map(pendingApprovals.map((a) => [a.companyId, a._count._all]));
  const totalLlmP = llmMonth.reduce((s, l) => s + (l._sum.costP ?? 0), 0);
  const paying = companies.filter((c) => c.subscription?.status === "ACTIVE").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="mt-1 text-sm text-ink-400">Platform overview — {user.email}</p>
        </div>
        <Link
          href="/admin/invoices"
          className="rounded-lg border border-ink-800 px-3 py-1.5 text-sm text-ink-400 hover:text-white"
        >
          Invoice register →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="py-4">
          <p className="text-xs text-ink-400">Companies</p>
          <p className="mt-1 text-2xl font-bold">{companies.length}</p>
        </Card>
        <Card className="py-4">
          <p className="text-xs text-ink-400">Active subscriptions</p>
          <p className="mt-1 text-2xl font-bold">{paying}</p>
        </Card>
        <Card className="py-4">
          <p className="text-xs text-ink-400">LLM spend this month</p>
          <p className="mt-1 text-2xl font-bold">{formatINR(totalLlmP)}</p>
        </Card>
        <Card className="py-4">
          <p className="text-xs text-ink-400">Webhook errors</p>
          <p className="mt-1 text-2xl font-bold">{failedWebhooks}</p>
        </Card>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink-800 text-left text-xs text-ink-400">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Credits</th>
              <th className="px-4 py-3">LLM (mo)</th>
              <th className="px-4 py-3">Tasks</th>
              <th className="px-4 py-3">Inbox</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => {
              const usage = llm.get(c.id);
              const routeMeta = c.integrations[0]?.meta as { accountId?: string } | undefined;
              return (
                <tr key={c.id} className="border-b border-ink-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/live/${c.slug}`} className="text-brand-400 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-400">{c.owner.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === "ACTIVE" ? "success" : "outline"}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{c.planTier}</td>
                  <td className="px-4 py-3">{credits.get(c.id) ?? 0}</td>
                  <td className="px-4 py-3" title={`${((usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0)).toLocaleString()} tokens`}>
                    {formatINR(usage?.costP ?? 0)}
                  </td>
                  <td className="px-4 py-3">{c._count.tasks}</td>
                  <td className="px-4 py-3">{approvals.get(c.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <AdminActions
                      companyId={c.id}
                      status={c.status}
                      adBudgetCapRupees={Math.floor(c.adBudgetCapP / 100)}
                      routeAccountId={routeMeta?.accountId ?? null}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <CouponsAdmin />
    </div>
  );
}
