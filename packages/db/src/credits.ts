import { prisma } from "./client";
import type { CreditEntryType } from "@prisma/client";

export class InsufficientCreditsError extends Error {
  constructor(public balance: number, public required: number) {
    super(`Insufficient credits: have ${balance}, need ${required}`);
  }
}

async function appendEntry(params: {
  companyId: string;
  type: CreditEntryType;
  delta: number;
  reason: string;
  taskId?: string;
  razorpayOrderId?: string;
  requirePositiveBalance?: boolean;
}) {
  // Serializable tx: read balance, validate, append with balanceAfter.
  return prisma.$transaction(
    async (tx) => {
      const agg = await tx.creditLedgerEntry.aggregate({
        where: { companyId: params.companyId },
        _sum: { delta: true },
      });
      const balance = agg._sum.delta ?? 0;
      const balanceAfter = balance + params.delta;
      if (params.requirePositiveBalance && balanceAfter < 0) {
        throw new InsufficientCreditsError(balance, -params.delta);
      }
      return tx.creditLedgerEntry.create({
        data: {
          companyId: params.companyId,
          type: params.type,
          delta: params.delta,
          balanceAfter,
          reason: params.reason,
          taskId: params.taskId,
          razorpayOrderId: params.razorpayOrderId,
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}

export function grantCredits(companyId: string, credits: number, reason: string, razorpayOrderId?: string) {
  return appendEntry({ companyId, type: razorpayOrderId ? "PURCHASE" : "GRANT", delta: credits, reason, razorpayOrderId });
}

export function consumeCredits(companyId: string, credits: number, reason: string, taskId?: string) {
  return appendEntry({
    companyId,
    type: "CONSUME",
    delta: -credits,
    reason,
    taskId,
    requirePositiveBalance: true,
  });
}

/** Auto-refund on failed tasks. */
export function refundCredits(companyId: string, credits: number, reason: string, taskId?: string) {
  return appendEntry({ companyId, type: "REFUND", delta: credits, reason, taskId });
}

export async function creditBalance(companyId: string): Promise<number> {
  const agg = await prisma.creditLedgerEntry.aggregate({
    where: { companyId },
    _sum: { delta: true },
  });
  return agg._sum.delta ?? 0;
}
