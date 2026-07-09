import Link from "next/link";
import { prisma } from "@adventure/db";
import { PLANS, TRIAL_DAYS, TRIAL_PRICE_PAISE, formatINR } from "@adventure/core";
import { requireUser } from "@/lib/auth";
import { Badge, Button, Card } from "@/components/ui";
import { DeleteAccount } from "@/components/delete-account";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft — free plan",
  PROVISIONING: "Provisioning…",
  ACTIVE: "Agents running",
  PAUSED: "Paused",
  LAPSED: "Lapsed",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const companies = await prisma.company.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, status: true, planTier: true, positioning: true },
  });

  const hasPaid = companies.some((c) => c.planTier !== "FREE");

  // Free users see only the subscription options — full account access is a
  // paid (or trial) feature. They still need a company to attach a plan to.
  if (companies.length > 0 && !hasPaid) {
    const first = companies[0];
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold">Choose a plan to unlock your account</h1>
        <p className="mt-2 text-sm text-ink-400">
          Your company <strong>{first.name}</strong> is founded and waiting. Pick a plan to switch
          your AI agents on and access the dashboard.
        </p>
        <Card className="mt-8 border-brand-500">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{TRIAL_DAYS}-day trial</h2>
              <p className="mt-1 text-sm text-ink-400">
                Everything in Pro — one-time {formatINR(TRIAL_PRICE_PAISE)}, no auto-renewal.
              </p>
            </div>
            <Link href={`/c/${first.slug}/billing`}>
              <Button>Try for {formatINR(TRIAL_PRICE_PAISE)}</Button>
            </Link>
          </div>
        </Card>
        <Card className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{PLANS.PRO.name}</h2>
              <p className="mt-1 text-sm text-ink-400">
                {formatINR(PLANS.PRO.pricePaise)}/mo — full autonomous daily cycle, deployed
                website, and 8 welcome credits.
              </p>
            </div>
            <Link href={`/c/${first.slug}/billing`}>
              <Button variant="outline">Subscribe</Button>
            </Link>
          </div>
        </Card>
        <DeleteAccount />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your companies</h1>
        <div className="flex items-center gap-3">
          <Link href="/audit">
            <Button variant="outline">Audit my existing business</Button>
          </Link>
          <Link href="/onboarding">
            <Button>+ New company</Button>
          </Link>
        </div>
      </div>

      {companies.length === 0 ? (
        <Card className="mt-10 py-16 text-center">
          <h2 className="text-xl font-semibold">No companies yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-400">
            Describe a business idea — or let the AI invent one — and get a company name,
            positioning, landing page, and 30-day plan in about a minute.
          </p>
          <Link href="/onboarding" className="mt-6 inline-block">
            <Button size="lg">Create your first company</Button>
          </Link>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {companies.map((c) => (
            <Link key={c.id} href={`/c/${c.slug}`}>
              <Card className="h-full transition-colors hover:border-brand-500">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  <Badge variant={c.status === "ACTIVE" ? "success" : "outline"}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-400">{c.positioning}</p>
                <p className="mt-4 text-xs text-ink-400">Plan: {c.planTier}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <DeleteAccount />
    </div>
  );
}
