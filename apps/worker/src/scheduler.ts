import type { Queue } from "bullmq";
import { prisma } from "@adventure/db";
import { TRIAL_ENDS_AT, queuePriority } from "@adventure/core";
import type { AgentQueueName } from "./queues";

/**
 * DB-driven scheduler: the database is the source of truth, BullMQ is just the
 * execution engine. Every 60s:
 *   1. Companies in PROVISIONING → enqueue a provisioning job (idempotent).
 *   2. ACTIVE companies with no brief today and inside their cycle window →
 *      enqueue an orchestrator cycle. Cycle hours are staggered per company.
 *   3. PENDING tasks → enqueue on their agent's queue and mark QUEUED.
 *
 * This keeps the web app (Vercel) fully decoupled from Redis — it only writes
 * rows; the worker notices them here.
 */
export function startScheduler(queues: Record<AgentQueueName, Queue>) {
  const tick = async () => {
    try {
      // 0. Lapse expired ₹10 trials (offer ends TRIAL_ENDS_AT). LAPSED starts
      // the same 90-day retention window as a cancelled subscription.
      if (new Date() >= TRIAL_ENDS_AT) {
        const expired = await prisma.company.findMany({
          where: { planTier: "TRIAL", status: { in: ["PROVISIONING", "ACTIVE", "PAUSED"] } },
          select: { id: true },
        });
        for (const c of expired) {
          await prisma.$transaction([
            prisma.company.update({
              where: { id: c.id },
              data: { status: "LAPSED", taskCyclesPerDay: 0, lapsedAt: new Date() },
            }),
            prisma.activityLog.create({
              data: {
                companyId: c.id,
                agent: "FINANCE",
                action: "Trial ended (15 July) — upgrade to Pro to keep your agents running",
                isPublic: false,
              },
            }),
          ]);
        }
      }

      // 1. Provisioning
      const provisioning = await prisma.company.findMany({
        where: { status: "PROVISIONING" },
        select: { id: true, slug: true },
      });
      for (const c of provisioning) {
        await queues.provisioning.add(
          "provision",
          { companyId: c.id },
          { jobId: `provision-${c.id}`, removeOnComplete: true },
        );
      }

      // 2. Orchestrator daily cycles (staggered by companyId hash)
      const active = await prisma.company.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, taskCyclesPerDay: true, planTier: true },
      });
      const now = new Date();
      const today = new Date(now.toISOString().slice(0, 10));
      for (const c of active) {
        const cycles = Math.max(1, c.taskCyclesPerDay);
        const stagger = hash(c.id) % 24;
        const cycleHours = Array.from({ length: cycles }, (_, i) =>
          Math.floor((stagger + (i * 24) / cycles) % 24),
        );
        if (!cycleHours.includes(now.getUTCHours())) continue;
        const hasBriefToday = await prisma.dailyBrief.findUnique({
          where: { companyId_date: { companyId: c.id, date: today } },
          select: { id: true },
        });
        if (hasBriefToday) continue; // runDailyCycle is also idempotent, this just saves a job
        await queues.orchestrator.add(
          "daily-cycle",
          { companyId: c.id },
          {
            jobId: `cycle-${c.id}-${today.toISOString().slice(0, 10)}-${now.getUTCHours()}`,
            priority: queuePriority(c.planTier), // Scale perk: jumps the queue
            removeOnComplete: true,
          },
        );
      }

      // 3. Pending tasks → agent queues (incl. approved tasks the web app
      //    flipped back to PENDING — the runner resumes at the ship step).
      const AGENT_QUEUE: Partial<Record<string, AgentQueueName>> = {
        ENGINEER: "engineer",
        SOCIAL: "social",
        EMAIL_OUTREACH: "email-outreach",
        SUPPORT: "support",
        RESEARCH: "research",
        FINANCE: "finance",
        ADS: "ads",
      };
      const pending = await prisma.task.findMany({
        where: {
          status: "PENDING",
          agent: { in: ["ENGINEER", "SOCIAL", "EMAIL_OUTREACH", "SUPPORT", "RESEARCH", "FINANCE", "ADS"] },
        },
        select: { id: true, companyId: true, agent: true, company: { select: { planTier: true } } },
        take: 50,
      });
      for (const t of pending) {
        const queueName = AGENT_QUEUE[t.agent];
        if (!queueName) continue;
        const state = await prisma.agentState.findUnique({
          where: { companyId_agent: { companyId: t.companyId, agent: t.agent } },
          select: { enabled: true },
        });
        if (state && !state.enabled) continue; // paused agent: task stays PENDING
        await queues[queueName].add(
          "task",
          { taskId: t.id },
          {
            jobId: `task-${t.id}`,
            priority: queuePriority(t.company.planTier), // Scale perk: jumps the queue
            removeOnComplete: true,
          },
        );
        await prisma.task.update({ where: { id: t.id }, data: { status: "QUEUED" } });
      }
    } catch (err) {
      console.error("[scheduler] tick failed:", err);
    }
  };

  void tick();
  return setInterval(tick, 60_000);
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
