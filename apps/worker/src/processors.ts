import { Worker, type Job } from "bullmq";
import type IORedis from "ioredis";
import { prisma, refundCredits } from "@adventure/db";
import {
  runDailyCycle,
  runEngineerTask,
  runSocialTask,
  runOutreachTask,
  runSupportTask,
  runResearchTask,
  runFinanceTask,
  runAdsTask,
  provisionCompany,
  logActivity,
} from "@adventure/agents";
import type { AgentQueueName } from "./queues";

/**
 * A queue worker for a task-based agent: marks the task RUNNING, delegates to
 * the agent runner, and on final failure flags the task + refunds credits.
 * (Runners may finish in AWAITING_APPROVAL instead of COMPLETED — the
 * scheduler re-queues the task after the founder decides.)
 */
function taskWorker(
  queue: AgentQueueName,
  run: (taskId: string) => Promise<void>,
  connection: IORedis,
): Worker {
  const worker = new Worker(
    queue,
    async (job: Job<{ taskId: string }>) => {
      console.log(`[${queue}] task ${job.data.taskId}`);
      await prisma.task.update({
        where: { id: job.data.taskId },
        data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } },
      });
      await run(job.data.taskId);
    },
    { connection, concurrency: 2 },
  );

  // Retry accounting + graceful failure: after the final attempt, flag the
  // task and auto-refund any credits it consumed.
  worker.on("failed", async (job, err) => {
    if (!job?.data?.taskId) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    try {
      const task = await prisma.task.update({
        where: { id: job.data.taskId },
        data: exhausted
          ? { status: "FAILED", error: String(err).slice(0, 500) }
          : { status: "QUEUED", error: String(err).slice(0, 500) },
      });
      if (exhausted) {
        if (task.creditsCost > 0) {
          await refundCredits(task.companyId, task.creditsCost, `Auto-refund: task "${task.title}" failed`, task.id);
        }
        await logActivity({
          companyId: task.companyId,
          agent: task.agent,
          action: `Task failed after ${job.attemptsMade} attempts: ${task.title}${task.creditsCost > 0 ? ` — ${task.creditsCost} credit(s) refunded` : ""}`,
          taskId: task.id,
          isPublic: false,
        });
      }
    } catch (e) {
      console.error(`[${queue}] failure handler error:`, e);
    }
  });

  return worker;
}

export function startWorkers(connection: IORedis): Worker[] {
  const opts = { connection, concurrency: 2 };

  const provisioning = new Worker(
    "provisioning",
    async (job: Job<{ companyId: string }>) => {
      console.log(`[provisioning] company ${job.data.companyId}`);
      await provisionCompany(job.data.companyId);
    },
    opts,
  );

  const orchestrator = new Worker(
    "orchestrator",
    async (job: Job<{ companyId: string }>) => {
      console.log(`[orchestrator] daily cycle for ${job.data.companyId}`);
      const { dispatched } = await runDailyCycle(job.data.companyId);
      console.log(`[orchestrator] dispatched ${dispatched.length} task(s)`);
    },
    opts,
  );

  const workers = [
    provisioning,
    orchestrator,
    taskWorker("engineer", runEngineerTask, connection),
    taskWorker("social", runSocialTask, connection),
    taskWorker("email-outreach", runOutreachTask, connection),
    taskWorker("support", runSupportTask, connection),
    taskWorker("research", runResearchTask, connection),
    taskWorker("finance", runFinanceTask, connection),
    taskWorker("ads", runAdsTask, connection),
  ];

  for (const w of workers) {
    w.on("error", (err) => console.error(`[worker:${w.name}]`, err));
  }
  return workers;
}
