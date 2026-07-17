import Link from "next/link";
import { prisma } from "@adventure/db";
import { formatINR, PLANS } from "@adventure/core";
import { requireUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { BillingProfileForm } from "@/components/billing-profile";

export const dynamic = "force-dynamic";

export default async function BillingHomePage() {
  const user = await requireUser();

  const [profile, invoices, companies] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { billingName: true, billingGstin: true, billingAddress: true, shippingAddress: true },
    }),
    prisma.invoice.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, number: true, description: true, totalP: true, createdAt: true },
    }),
    prisma.company.findMany({
      where: { ownerId: user.id },
      select: {
        name: true,
        slug: true,
        planTier: true,
        status: true,
        trialEndsAt: true,
        subscription: { select: { status: true, currentPeriodEnd: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing &amp; subscription</h1>
        <p className="mt-1 text-sm text-ink-400">
          Your GST invoices, plans across all your companies, and the details we put on your
          invoices.
        </p>
      </div>

      <Card>
        <h2 className="font-semibold">Plans &amp; subscriptions</h2>
        {companies.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">No companies yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-800">
            {companies.map((c) => (
              <li key={c.slug} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/c/${c.slug}`} className="text-sm font-medium hover:underline">
                    {c.name}
                  </Link>
                  <p className="text-xs text-ink-400">
                    {PLANS[c.planTier].name}
                    {c.subscription?.currentPeriodEnd
                      ? ` · renews ${new Date(c.subscription.currentPeriodEnd).toLocaleDateString("en-IN")}`
                      : c.planTier === "TRIAL" && c.trialEndsAt
                        ? ` · trial ends ${new Date(c.trialEndsAt).toLocaleDateString("en-IN")}`
                        : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.status === "ACTIVE" ? "success" : "outline"}>{c.status}</Badge>
                  <Link href={`/c/${c.slug}/billing`} className="text-xs text-brand-400 hover:underline">
                    Manage →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">
            No invoices yet — they&apos;re generated automatically when a payment completes.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="pb-2 pr-4">Invoice</th>
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">For</th>
                  <th className="pb-2 pr-4 text-right">Total</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2 pr-4 font-mono text-xs">{inv.number}</td>
                    <td className="py-2 pr-4 text-ink-400">
                      {inv.createdAt.toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-2 pr-4 text-ink-100">{inv.description}</td>
                    <td className="py-2 pr-4 text-right font-medium">{formatINR(inv.totalP)}</td>
                    <td className="py-2">
                      <Link href={`/billing/invoices/${inv.id}`} className="text-brand-400 hover:underline">
                        View / print
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold">Billing details</h2>
        <div className="mt-3">
          <BillingProfileForm
            initial={{
              billingName: profile?.billingName ?? null,
              billingGstin: profile?.billingGstin ?? null,
              billingAddress: profile?.billingAddress ?? null,
              shippingAddress: profile?.shippingAddress ?? null,
            }}
          />
        </div>
      </Card>
    </div>
  );
}
