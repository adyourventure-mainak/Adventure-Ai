import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { saveMemory } from "@adventure/agents";
import { getUser } from "@/lib/auth";

const Input = z.object({
  taskId: z.string(),
  rating: z.enum(["up", "down"]),
  note: z.string().trim().max(300).optional(),
});

/**
 * Feedback loop: the owner rates a deliverable in the inbox. The rating (and
 * optional note) is stored as an embedded "feedback" memory, so semantic
 * recall feeds it into every future generation for this company — the agents
 * learn the owner's taste over time.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  const task = await prisma.task.findUnique({
    where: { id: parsed.data.taskId },
    select: { id: true, companyId: true, agent: true, title: true, result: true },
  });
  if (!task || task.companyId !== company.id) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }

  // A short excerpt of what was rated makes the memory actionable on recall.
  const result = task.result as Record<string, unknown> | null;
  const excerpt = JSON.stringify(result ?? {}).slice(0, 300);
  const verdict = parsed.data.rating === "up" ? "LIKED" : "DISLIKED";
  await saveMemory({
    companyId: company.id,
    agent: task.agent,
    kind: "feedback",
    content: `Owner ${verdict} the ${task.agent} deliverable "${task.title}".${
      parsed.data.note ? ` Owner's note: "${parsed.data.note}".` : ""
    } Excerpt: ${excerpt}`,
    taskId: task.id,
  });

  return NextResponse.json({ ok: true });
}
