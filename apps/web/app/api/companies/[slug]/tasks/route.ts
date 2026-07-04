import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, consumeCredits, creditBalance, InsufficientCreditsError } from "@adventure/db";
import { getUser } from "@/lib/auth";

const Input = z.object({
  instruction: z.string().min(10).max(2000),
});

/**
 * On-demand task: the user asks the Engineer for a change outside the included
 * daily cycle. Costs 1 credit; auto-refunded by the worker if the task fails.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Describe the change in at least a sentence." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true, status: true, planTier: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (company.planTier === "FREE") {
    return NextResponse.json(
      { error: "Upgrade to Pro to send tasks to your agents." },
      { status: 403 },
    );
  }

  const title = parsed.data.instruction.slice(0, 80);
  const task = await prisma.task.create({
    data: {
      companyId: company.id,
      agent: "ENGINEER",
      type: "landing_page_edit",
      title,
      source: "ON_DEMAND",
      status: "PENDING",
      creditsCost: 1,
      payload: { instruction: parsed.data.instruction, requestedBy: user.email },
    },
  });

  try {
    await consumeCredits(company.id, 1, `On-demand task: ${title}`, task.id);
  } catch (err) {
    await prisma.task.delete({ where: { id: task.id } });
    if (err instanceof InsufficientCreditsError) {
      const balance = await creditBalance(company.id);
      return NextResponse.json(
        { error: `No credits left (balance: ${balance}). Buy a credit pack to queue extra tasks.` },
        { status: 402 },
      );
    }
    throw err;
  }

  return NextResponse.json({ taskId: task.id });
}
