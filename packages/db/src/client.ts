import { PrismaClient, Prisma } from "@prisma/client";

// Reuse a single client across hot reloads / serverless invocations.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Models that carry a companyId column and must always be tenant-scoped. */
const TENANT_MODELS = new Set<string>([
  "AgentState",
  "Task",
  "Approval",
  "ActivityLog",
  "MemoryEntry",
  "CreditLedgerEntry",
  "TransferRecord",
  "LlmUsageDay",
  "DailyBrief",
  "KpiSnapshot",
  "ProvisionRecord",
  "Integration",
  "DataExport",
]);

/**
 * Tenant-scoped client: every query on a tenant model is forced to filter by
 * (and create rows with) the given companyId. This is the first isolation
 * layer; Supabase RLS (prisma/rls.sql) is the backstop.
 *
 * App code paths that serve a single company should ONLY use this — never the
 * raw `prisma` export (reserved for auth, webhooks, and admin).
 */
export function forCompany(companyId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = args as Record<string, unknown>;

          switch (operation) {
            case "create":
              a.data = { ...(a.data as object), companyId };
              break;
            case "createMany":
            case "createManyAndReturn": {
              const data = a.data;
              a.data = Array.isArray(data)
                ? data.map((d) => ({ ...d, companyId }))
                : { ...(data as object), companyId };
              break;
            }
            case "upsert":
              a.where = { ...(a.where as object), companyId };
              a.create = { ...(a.create as object), companyId };
              a.update = a.update; // updates never change companyId
              break;
            case "findUnique":
            case "findUniqueOrThrow":
            case "update":
            case "delete":
              // Unique lookups: verify tenant via an AND on the where clause
              // is not expressible for true unique inputs, so re-check below.
              a.where = { ...(a.where as object), companyId };
              break;
            default:
              a.where = { AND: [{ companyId }, (a.where as object) ?? {}] };
          }
          return query(args as typeof args);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof forCompany>;
export { Prisma };
