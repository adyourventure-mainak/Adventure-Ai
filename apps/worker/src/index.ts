// Adventure AI worker service (Railway).
// Provisioning + agent processors (Orchestrator, Engineer, Social,
// Email Outreach, Support) + DB-driven scheduler.
import "./env";
import { createQueues, redisConnection, AGENT_QUEUES } from "./queues";
import { startWorkers } from "./processors";
import { startScheduler } from "./scheduler";

async function main() {
  const connection = redisConnection();
  connection.on("error", (err) => console.error("[redis]", err.message));

  const queues = createQueues(connection);
  startWorkers(redisConnection());
  startScheduler(queues);

  console.log(`[worker] booted. queues: ${AGENT_QUEUES.join(", ")}`);
  console.log(
    "[worker] processors: provisioning, orchestrator, engineer, social, email-outreach, support, research, finance, ads. scheduler: 60s tick.",
  );
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
