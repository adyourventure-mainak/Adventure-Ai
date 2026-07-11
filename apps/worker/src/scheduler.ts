import type { Queue } from "bullmq";
import { prisma } from "@adventure/db";
import { queuePriority } from "@adventure/core";
import { vercel, github } from "@adventure/agents";
import type { AgentQueueName } from "./queues";
import { sendLifecycleEmails } from "./emails";

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
      // 0. Lapse expired trials (Company.trialEndsAt = activation + 15 days).
      // LAPSED starts the same 90-day retention window as a cancellation.
      {
        const expired = await prisma.company.findMany({
          where: {
            planTier: "TRIAL",
            status: { in: ["PROVISIONING", "ACTIVE", "PAUSED"] },
            trialEndsAt: { lt: new Date() },
          },
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
                action: "Trial ended — upgrade to Pro to keep your agents running",
                isPublic: false,
              },
            }),
          ]);
        }
      }

      // 0a. Owner-requested company deletions: tear down the live site and
      // repo (worker holds the platform tokens), then wipe every row.
      {
        const deleting = await prisma.company.findMany({
          where: { status: "DELETING" },
          select: {
            id: true,
            name: true,
            provisions: { select: { resource: true, status: true, externalId: true } },
          },
          take: 5,
        });
        for (const c of deleting) {
          try {
            const project = c.provisions.find((p) => p.resource === "VERCEL_PROJECT" && p.externalId);
            if (project?.externalId && vercel.vercelConfigured()) {
              await vercel.deleteProject(project.externalId);
            }
            const repo = c.provisions.find((p) => p.resource === "GITHUB_REPO" && p.externalId);
            if (repo?.externalId && github.githubConfigured()) {
              await github.deleteRepo(repo.externalId);
            }
            const ids = [c.id];
            await prisma.$transaction([
              prisma.approval.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.activityLog.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.memoryEntry.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.creditLedgerEntry.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.task.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.integration.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.provisionRecord.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.landingPage.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.dailyBrief.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.kpiSnapshot.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.transferRecord.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.llmUsageDay.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.dataExport.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.companyPlan.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.agentState.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.subscription.deleteMany({ where: { companyId: { in: ids } } }),
              prisma.company.deleteMany({ where: { id: { in: ids } } }),
            ]);
            console.log(`[scheduler] deleted company ${c.id} ("${c.name}") incl. site + repo`);
          } catch (err) {
            console.error(`[scheduler] company deletion failed for ${c.id}:`, err);
          }
        }
      }

      // 0a2. Finish account deletions: once a deleted user's companies are all
      // torn down (step 0a), remove audits, slot tombstones, the user row, and
      // (re)try removing the Supabase auth user so the login stays dead.
      {
        const goners = await prisma.user.findMany({
          where: { deletedAt: { not: null }, companies: { none: {} } },
          select: { id: true, email: true },
          take: 5,
        });
        for (const u of goners) {
          try {
            const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (supabaseUrl && serviceKey) {
              const res = await fetch(
                `${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users/${u.id}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
                },
              );
              if (!res.ok && res.status !== 404) {
                throw new Error(`auth user delete failed (${res.status})`);
              }
            }
            await prisma.$transaction([
              prisma.businessAudit.deleteMany({ where: { userId: u.id } }),
              prisma.deletedCompanySlot.deleteMany({ where: { ownerId: u.id } }),
              prisma.user.delete({ where: { id: u.id } }),
            ]);
            console.log(`[scheduler] account fully deleted: ${u.email}`);
          } catch (err) {
            console.error(`[scheduler] account cleanup failed for ${u.id}:`, err);
          }
        }
      }

      // 0b. The approval step was removed — deliverables now ship straight to
      // the inbox. Auto-approve any drafts still parked from before and
      // requeue their tasks so the runners resume at the ship step.
      {
        const parked = await prisma.approval.findMany({
          where: { status: "PENDING", task: { status: "AWAITING_APPROVAL" } },
          select: { id: true, taskId: true },
          take: 50,
        });
        for (const a of parked) {
          await prisma.$transaction([
            prisma.approval.update({
              where: { id: a.id },
              data: { status: "APPROVED", decidedAt: new Date() },
            }),
            prisma.task.update({ where: { id: a.taskId }, data: { status: "PENDING" } }),
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

      // 4. Owner lifecycle emails: daily activity reminders while the
      //    subscription runs, weekly win-back once it stops.
      await sendLifecycleEmails();
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
