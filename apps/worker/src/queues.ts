import { Queue } from "bullmq";
import IORedis from "ioredis";

// One BullMQ queue per agent, plus provisioning.
export const AGENT_QUEUES = [
  "orchestrator",
  "planner",
  "engineer",
  "social",
  "email-outreach",
  "support",
  "ads",
  "finance",
  "research",
  "provisioning",
] as const;

export type AgentQueueName = (typeof AGENT_QUEUES)[number];

export function redisConnection() {
  return new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    // Railway private networking is IPv6-only; family:0 lets DNS resolve both
    // A and AAAA records so `*.railway.internal` hostnames work. Harmless on
    // IPv4-only hosts (localhost dev).
    family: 0,
  });
}

export function createQueues(connection: IORedis) {
  return Object.fromEntries(
    AGENT_QUEUES.map((name) => [
      name,
      new Queue(name, {
        connection,
        defaultJobOptions: {
          attempts: 3, // 1 run + 2 retries; failure hook refunds credits
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: { age: 7 * 24 * 3600 },
          removeOnFail: false,
        },
      }),
    ]),
  ) as Record<AgentQueueName, Queue>;
}
