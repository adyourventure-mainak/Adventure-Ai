import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { getUser } from "@/lib/auth";

const Input = z.object({
  decision: z.enum(["approve", "reject"]),
  editedDraft: z.record(z.unknown()).optional(),
});

/**
 * Founder decides on a pending approval. Approve flips the task back to
 * PENDING — the worker's scheduler re-queues it and the agent runner resumes
 * at the ship step (with the edited draft, if provided). Reject cancels the
 * task. The web app never touches Redis; the DB row change is the signal.
 */
export async function POST(
  request: Request,
  { params }: { params: { slug: string; approvalId: string } },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid decision" }, { status: 400 });
  }

  const approval = await prisma.approval.findUnique({
    where: { id: params.approvalId },
    include: { company: { select: { slug: true, ownerId: true } }, task: true },
  });
  if (!approval || approval.company.slug !== params.slug || approval.company.ownerId !== user.id) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }
  if (approval.status !== "PENDING") {
    return NextResponse.json({ error: "Already decided" }, { status: 409 });
  }

  const { decision, editedDraft } = parsed.data;
  const approve = decision === "approve";
  const status = approve ? (editedDraft ? "EDITED_AND_APPROVED" : "APPROVED") : "REJECTED";

  await prisma.$transaction([
    prisma.approval.update({
      where: { id: approval.id },
      data: {
        status,
        decidedAt: new Date(),
        ...(editedDraft ? { editedDraft: editedDraft as object } : {}),
      },
    }),
    prisma.task.update({
      where: { id: approval.taskId },
      data: approve
        ? { status: "PENDING" } // scheduler re-queues; runner ships the approved draft
        : { status: "CANCELLED", completedAt: new Date() },
    }),
    prisma.activityLog.create({
      data: {
        companyId: approval.companyId,
        agent: approval.task.agent,
        taskId: approval.taskId,
        action: approve
          ? `Founder approved${editedDraft ? " (with edits)" : ""}: ${approval.task.title}`
          : `Founder rejected: ${approval.task.title}`,
        isPublic: false,
      },
    }),
  ]);

  return NextResponse.json({ status });
}
