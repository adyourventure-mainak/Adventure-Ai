import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@adventure/db";
import type { BusinessAuditReport } from "@adventure/core";
import { requireUser } from "@/lib/auth";
import { Badge, Button, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const SWOT_STYLE: Record<string, { title: string; accent: string }> = {
  strengths: { title: "Strengths", accent: "text-green-400" },
  weaknesses: { title: "Weaknesses", accent: "text-red-400" },
  opportunities: { title: "Opportunities", accent: "text-brand-400" },
  threats: { title: "Threats", accent: "text-yellow-400" },
};

export default async function AuditReportPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const audit = await prisma.businessAudit.findUnique({ where: { id: params.id } });
  if (!audit || audit.userId !== user.id) notFound();

  const report = audit.report as BusinessAuditReport | null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{audit.businessName ?? audit.websiteUrl}</h1>
          <p className="mt-1 text-sm text-ink-400">
            {audit.websiteUrl} · {audit.createdAt.toLocaleDateString("en-IN")}
          </p>
        </div>
        <Link href="/audit">
          <Button variant="outline" size="sm">All audits</Button>
        </Link>
      </div>

      {audit.status === "FAILED" && (
        <Card className="border-red-500/50">
          <h2 className="font-semibold">Audit failed</h2>
          <p className="mt-2 text-sm text-ink-400">{audit.error ?? "Unknown error"}</p>
          <p className="mt-2 text-sm text-ink-400">
            Check that the website is reachable, then request a new audit.
          </p>
        </Card>
      )}

      {report && (
        <>
          <Card>
            <h2 className="font-semibold">Business summary</h2>
            <p className="mt-2 text-sm text-ink-100">{report.businessSummary}</p>
          </Card>

          <Card>
            <h2 className="font-semibold">Market research</h2>
            <div className="mt-4 space-y-4 text-sm text-ink-100">
              <div>
                <h3 className="text-xs font-semibold uppercase text-ink-400">Industry overview</h3>
                <p className="mt-1">{report.marketResearch.industryOverview}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-ink-400">Market size & growth</h3>
                <p className="mt-1">{report.marketResearch.marketSizeAndGrowth}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-ink-400">Key trends</h3>
                <ul className="mt-1 list-inside list-disc">
                  {report.marketResearch.keyTrends.map((t) => <li key={t}>{t}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-ink-400">Target segments</h3>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  {report.marketResearch.targetSegments.map((s) => (
                    <div key={s.name} className="rounded-lg border border-ink-800 p-3">
                      <p className="font-semibold text-brand-400">{s.name}</p>
                      <p className="mt-1">{s.description}</p>
                      <p className="mt-1 text-ink-400">Why they buy: {s.whyTheyBuy}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase text-ink-400">Competitive landscape</h3>
                <p className="mt-1">{report.marketResearch.competitiveLandscape}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">SWOT analysis</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {(Object.keys(SWOT_STYLE) as (keyof typeof report.swot)[]).map((key) => (
                <div key={key} className="rounded-lg border border-ink-800 p-4">
                  <h3 className={`text-sm font-semibold ${SWOT_STYLE[key].accent}`}>
                    {SWOT_STYLE[key].title}
                  </h3>
                  <ul className="mt-2 list-inside list-disc text-sm text-ink-100">
                    {report.swot[key].map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-semibold">Scope — products & services</h2>
            <div className="mt-4 space-y-4">
              {report.scope.map((s) => (
                <div key={s.offering} className="rounded-lg border border-ink-800 p-4 text-sm">
                  <h3 className="font-semibold text-brand-400">{s.offering}</h3>
                  <p className="mt-1 text-ink-100">{s.currentPosition}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-green-400">Expansion opportunities</p>
                      <ul className="list-inside list-disc text-ink-100">
                        {s.expansionOpportunities.map((o) => <li key={o}>{o}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-red-400">Risks</p>
                      <ul className="list-inside list-disc text-ink-100">
                        {s.risks.map((r) => <li key={r}>{r}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-brand-500">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Growth implementation plan</h2>
              <Badge>Senior marketing executive</Badge>
            </div>
            <p className="mt-3 text-sm text-ink-100">{report.implementationPlan.executiveSummary}</p>

            <h3 className="mt-5 text-xs font-semibold uppercase text-ink-400">Quick wins — first 2 weeks</h3>
            <ul className="mt-1 list-inside list-disc text-sm text-ink-100">
              {report.implementationPlan.quickWins.map((q) => <li key={q}>{q}</li>)}
            </ul>

            <div className="mt-5 space-y-4">
              {report.implementationPlan.phases.map((p) => (
                <div key={p.phase} className="rounded-lg border border-ink-800 p-4 text-sm">
                  <h3 className="font-semibold text-brand-400">{p.phase}</h3>
                  <p className="mt-1 text-ink-400">{p.objective}</p>
                  <ul className="mt-2 list-inside list-disc text-ink-100">
                    {p.actions.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                  <p className="mt-2 text-ink-400">Expected outcome: {p.expectedOutcome}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-5 text-xs font-semibold uppercase text-ink-400">KPIs to track</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {report.implementationPlan.kpis.map((k) => (
                <div key={k.metric} className="rounded-lg border border-ink-800 p-3">
                  <p className="text-xs text-ink-400">{k.metric}</p>
                  <p className="text-sm font-semibold">{k.target}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
