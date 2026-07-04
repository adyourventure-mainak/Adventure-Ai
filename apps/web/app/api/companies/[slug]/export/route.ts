import { prisma } from "@adventure/db";
import { getUser } from "@/lib/auth";

/**
 * Full data export — owner-only, streamed as a JSON download. Everything the
 * company owns: foundation, tasks, approvals, activity, memory (content, not
 * embeddings), ledger, briefs, KPIs, transfers, provisioning. Integration
 * secrets are never exported. A DataExport row records each export.
 */
export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    include: {
      plan: true,
      landingPage: true,
      subscription: true,
      provisions: true,
      dailyBriefs: { orderBy: { date: "asc" } },
      kpiSnapshots: { orderBy: { date: "asc" } },
      creditEntries: { orderBy: { createdAt: "asc" } },
      transfers: { orderBy: { createdAt: "asc" } },
      tasks: { orderBy: { createdAt: "asc" } },
      approvals: { orderBy: { createdAt: "asc" } },
      activityLogs: { orderBy: { createdAt: "asc" } },
      memoryEntries: {
        orderBy: { createdAt: "asc" },
        select: { id: true, agent: true, kind: true, content: true, taskId: true, createdAt: true },
      },
      integrations: {
        select: { provider: true, status: true, meta: true, createdAt: true }, // no encryptedCred
      },
    },
  });
  if (!company || company.ownerId !== user.id) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  await prisma.dataExport.create({
    data: { companyId: company.id, completedAt: new Date() },
  });

  const exported = {
    exportedAt: new Date().toISOString(),
    format: "adventure-ai-export-v1",
    company,
  };

  return new Response(JSON.stringify(exported, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${company.slug}-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
