import { notFound } from "next/navigation";
import { prisma } from "@adventure/db";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const AGENT_EMOJI: Record<string, string> = {
  ORCHESTRATOR: "🧭",
  PLANNER: "🗺️",
  ENGINEER: "🛠️",
  SOCIAL: "📣",
  EMAIL_OUTREACH: "✉️",
  SUPPORT: "🎧",
  ADS: "🎯",
  FINANCE: "📊",
  RESEARCH: "🔍",
};

/**
 * Public read-only feed: watch a company's AI team work in real time.
 * Only isPublic activity appears; drafts, financials and customer
 * conversations never do.
 */
export default async function LivePage({ params }: { params: { slug: string } }) {
  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: {
      name: true,
      status: true,
      ideaSummary: true,
      positioning: true,
      createdAt: true,
      landingPage: { select: { deployedUrl: true, version: true } },
      activityLogs: {
        where: { isPublic: true },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, agent: true, action: true, createdAt: true },
      },
    },
  });
  // DRAFT companies are private previews — only provisioned ones go public.
  if (!company || company.status === "DRAFT") notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="text-center">
        <Badge variant={company.status === "ACTIVE" ? "success" : "outline"}>
          {company.status === "ACTIVE" ? "● agents working" : company.status.toLowerCase()}
        </Badge>
        <h1 className="mt-4 text-3xl font-bold">{company.name}</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-400">{company.ideaSummary}</p>
        {company.landingPage?.deployedUrl && (
          <a
            href={company.landingPage.deployedUrl}
            target="_blank"
            className="mt-4 inline-block text-sm text-brand-400 hover:underline"
          >
            ↗ Visit {company.landingPage.deployedUrl.replace("https://", "")}
          </a>
        )}
        <p className="mt-6 text-xs text-ink-400">
          An autonomous business run by AI agents on{" "}
          <a href="/" className="text-brand-400 hover:underline">
            Adventure AI
          </a>{" "}
          · building since {company.createdAt.toISOString().slice(0, 10)}
        </p>
      </div>

      <Card className="mt-10 p-0">
        <div className="border-b border-ink-800 px-6 py-4">
          <h2 className="font-semibold">Live activity</h2>
        </div>
        {company.activityLogs.length === 0 ? (
          <p className="px-6 py-8 text-sm text-ink-400">The team is just getting started.</p>
        ) : (
          <ul className="divide-y divide-ink-800/50">
            {company.activityLogs.map((log) => (
              <li key={log.id} className="flex gap-3 px-6 py-4">
                <span className="text-lg" title={log.agent}>
                  {AGENT_EMOJI[log.agent] ?? "🤖"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink-100">{log.action}</p>
                  <p className="mt-1 text-xs text-ink-400">
                    {log.agent.toLowerCase().replace("_", " ")} ·{" "}
                    {log.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
