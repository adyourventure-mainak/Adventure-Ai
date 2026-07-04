import { prisma, Prisma } from "@adventure/db";
import type { AgentType } from "@adventure/db";
import { openai } from "./llm";

const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims — matches vector(1536)

async function embed(text: string): Promise<number[]> {
  const res = await openai().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  return res.data[0].embedding;
}

/** Append to the company's shared memory thread with an embedding for recall. */
export async function saveMemory(params: {
  companyId: string;
  agent: AgentType;
  kind: "decision" | "learning" | "customer_fact" | "research" | "event";
  content: string;
  taskId?: string;
}): Promise<void> {
  const entry = await prisma.memoryEntry.create({
    data: {
      companyId: params.companyId,
      agent: params.agent,
      kind: params.kind,
      content: params.content,
      taskId: params.taskId,
    },
    select: { id: true },
  });
  try {
    const vector = await embed(params.content);
    await prisma.$executeRaw`
      UPDATE memory_entries SET embedding = ${`[${vector.join(",")}]`}::vector
      WHERE id = ${entry.id}`;
  } catch (err) {
    // Memory stays usable via recency even if embedding fails.
    console.error("[memory] embedding failed:", err);
  }
}

export interface RecalledMemory {
  id: string;
  agent: AgentType;
  kind: string;
  content: string;
  createdAt: Date;
}

/** Semantic recall (falls back to recency when the query can't be embedded). */
export async function recallMemories(
  companyId: string,
  query: string,
  limit = 8,
): Promise<RecalledMemory[]> {
  try {
    const vector = await embed(query);
    return await prisma.$queryRaw<RecalledMemory[]>`
      SELECT id, agent, kind, content, "createdAt"
      FROM memory_entries
      WHERE "companyId" = ${companyId} AND embedding IS NOT NULL
      ORDER BY embedding <=> ${`[${vector.join(",")}]`}::vector
      LIMIT ${limit}`;
  } catch {
    return prisma.memoryEntry.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, agent: true, kind: true, content: true, createdAt: true },
    });
  }
}

/** Most recent memories regardless of topic (for daily-cycle context). */
export function recentMemories(companyId: string, limit = 10) {
  return prisma.memoryEntry.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, agent: true, kind: true, content: true, createdAt: true },
  });
}

export { Prisma };
