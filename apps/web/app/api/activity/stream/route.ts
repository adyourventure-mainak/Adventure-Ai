import { prisma } from "@adventure/db";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * SSE stream of a company's activity feed. Polls the DB (no Redis dependency
 * on Vercel) and closes after ~50s — EventSource reconnects automatically,
 * resuming from Last-Event-ID.
 */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return new Response("missing slug", { status: 400 });

  const company = await prisma.company.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!company || company.ownerId !== user.id) {
    return new Response("not found", { status: 404 });
  }

  const lastEventId = request.headers.get("last-event-id");
  let since = lastEventId ? new Date(lastEventId) : new Date();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown, id: string) =>
        controller.enqueue(encoder.encode(`id: ${id}\ndata: ${JSON.stringify(data)}\n\n`));

      controller.enqueue(encoder.encode(`retry: 3000\n\n`));
      const startedAt = Date.now();

      const poll = async () => {
        const logs = await prisma.activityLog.findMany({
          where: { companyId: company.id, createdAt: { gt: since } },
          orderBy: { createdAt: "asc" },
          take: 20,
        });
        for (const log of logs) {
          since = log.createdAt;
          send(
            {
              id: log.id,
              agent: log.agent,
              action: log.action,
              createdAt: log.createdAt.toISOString(),
              tokens: log.inputTokens + log.outputTokens,
            },
            log.createdAt.toISOString(),
          );
        }
      };

      while (Date.now() - startedAt < 50_000) {
        if (request.signal.aborted) break;
        try {
          await poll();
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          break;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
