import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { getUser } from "@/lib/auth";

const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("setAdCap"), adBudgetCapRupees: z.number().int().min(0).max(1000000) }),
  z.object({ action: z.literal("setRouteAccount"), accountId: z.string().regex(/^acc_[A-Za-z0-9]+$/) }),
]);

/** Admin actions on a company. isAdmin-gated. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await getUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, status: true },
  });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const input = parsed.data;
  switch (input.action) {
    case "pause": {
      if (company.status !== "ACTIVE") {
        return NextResponse.json({ error: `Cannot pause a ${company.status} company` }, { status: 409 });
      }
      await prisma.company.update({ where: { id: company.id }, data: { status: "PAUSED" } });
      break;
    }
    case "resume": {
      if (company.status !== "PAUSED") {
        return NextResponse.json({ error: `Cannot resume a ${company.status} company` }, { status: 409 });
      }
      await prisma.company.update({ where: { id: company.id }, data: { status: "ACTIVE" } });
      break;
    }
    case "setAdCap": {
      await prisma.company.update({
        where: { id: company.id },
        data: { adBudgetCapP: input.adBudgetCapRupees * 100 },
      });
      break;
    }
    case "setRouteAccount": {
      // Linked-account onboarding (KYC) happens on the Razorpay dashboard;
      // this records the resulting acc_... id so revenue-share transfers flow.
      await prisma.$transaction([
        prisma.integration.upsert({
          where: { companyId_provider: { companyId: company.id, provider: "RAZORPAY_ROUTE" } },
          create: {
            companyId: company.id,
            provider: "RAZORPAY_ROUTE",
            status: "CONNECTED",
            meta: { accountId: input.accountId },
          },
          update: { status: "CONNECTED", meta: { accountId: input.accountId } },
        }),
        prisma.provisionRecord.upsert({
          where: {
            companyId_resource: { companyId: company.id, resource: "RAZORPAY_LINKED_ACCOUNT" },
          },
          create: {
            companyId: company.id,
            resource: "RAZORPAY_LINKED_ACCOUNT",
            status: "DONE",
            externalId: input.accountId,
          },
          update: { status: "DONE", externalId: input.accountId, error: null },
        }),
      ]);
      break;
    }
  }

  await prisma.activityLog.create({
    data: {
      companyId: company.id,
      agent: "ORCHESTRATOR",
      action: `Admin action: ${input.action}`,
      detail: { by: user.email },
      isPublic: false,
    },
  });
  return NextResponse.json({ ok: true });
}
