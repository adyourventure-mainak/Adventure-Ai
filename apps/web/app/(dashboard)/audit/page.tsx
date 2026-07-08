import Link from "next/link";
import { prisma } from "@adventure/db";
import { requireUser } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { AuditRequestForm } from "./request-form";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireUser();
  const audits = await prisma.businessAudit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, websiteUrl: true, businessName: true, status: true, createdAt: true },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Business audit</h1>
        <p className="mt-1 text-sm text-ink-400">
          Already running a business? Get market research, a SWOT analysis, the scope for your
          products or services, and a growth implementation plan from a senior marketing
          executive — built from your website.
        </p>
      </div>

      <AuditRequestForm />

      {audits.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold">Your audits</h2>
          <div className="mt-4 space-y-3">
            {audits.map((a) => (
              <Link key={a.id} href={`/audit/${a.id}`} className="block">
                <Card className="transition-colors hover:border-brand-500">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.businessName ?? a.websiteUrl}</p>
                      <p className="text-xs text-ink-400">
                        {a.websiteUrl} · {a.createdAt.toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <Badge variant={a.status === "READY" ? "success" : "outline"}>{a.status}</Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
