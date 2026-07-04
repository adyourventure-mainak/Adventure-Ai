import { prisma, Prisma } from "@adventure/db";
import type { Task, Approval } from "@adventure/db";
import { logActivity } from "./activity";
import type { LlmUsage } from "./llm";

const APPROVAL_TTL_DAYS = 7;

/**
 * Park a drafted task in the approvals inbox: create the Approval row, move
 * the task to AWAITING_APPROVAL, and surface it on the activity feed. The
 * agent's runner is re-entered by the scheduler once the user decides
 * (approve → task back to PENDING; reject → CANCELLED).
 */
export async function requestApproval(params: {
  task: Task;
  kind: Approval["kind"];
  draft: Record<string, unknown>;
  summary: string;
  usage?: LlmUsage;
}): Promise<void> {
  const { task } = params;
  await prisma.$transaction([
    prisma.approval.create({
      data: {
        companyId: task.companyId,
        taskId: task.id,
        kind: params.kind,
        draft: params.draft as Prisma.InputJsonObject,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_DAYS * 24 * 3600 * 1000),
      },
    }),
    prisma.task.update({
      where: { id: task.id },
      data: { status: "AWAITING_APPROVAL" },
    }),
  ]);
  await logActivity({
    companyId: task.companyId,
    agent: task.agent,
    action: `Drafted and sent for your approval: ${params.summary}`,
    taskId: task.id,
    usage: params.usage,
    isPublic: false, // drafts stay private until approved
  });
}

/** The content that actually ships: the user's edit wins over the draft. */
export function approvedContent<T>(approval: Approval): T {
  return (approval.editedDraft ?? approval.draft) as unknown as T;
}

/**
 * Where an already-decided task should resume when its runner is re-entered.
 * "draft" means no decision exists yet and the agent should produce one.
 */
export function resumePhase(
  approval: Approval | null,
): "draft" | "execute" | "cancel" {
  if (!approval) return "draft";
  if (approval.status === "APPROVED" || approval.status === "EDITED_AND_APPROVED") return "execute";
  if (approval.status === "REJECTED" || approval.status === "EXPIRED") return "cancel";
  return "draft"; // PENDING — shouldn't be re-queued, but drafting again is harmless
}

/** Defensive terminal state for rejected/expired drafts that got re-queued. */
export async function cancelRejectedTask(taskId: string): Promise<void> {
  await prisma.task.update({
    where: { id: taskId },
    data: { status: "CANCELLED", completedAt: new Date() },
  });
}
