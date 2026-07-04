import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@adventure/db";
import { getUser } from "@/lib/auth";

const Input = z.object({
  message: z.string().min(5).max(4000),
  customerEmail: z.string().email().optional().or(z.literal("")),
});

/**
 * Forward a customer question to the Support agent. Free (no credits) — it's
 * the company serving its own customers, not extra build work. Until a
 * support-inbox integration exists, this form is how questions arrive.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Input.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste the customer's question (5+ characters)." }, { status: 400 });
  }

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    select: { id: true, ownerId: true, planTier: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (company.planTier === "FREE") {
    return NextResponse.json({ error: "Upgrade to Pro to activate the Support agent." }, { status: 403 });
  }

  const task = await prisma.task.create({
    data: {
      companyId: company.id,
      agent: "SUPPORT",
      type: "support_reply",
      title: `Customer: ${parsed.data.message.slice(0, 70)}`,
      source: "ON_DEMAND",
      status: "PENDING",
      payload: {
        customerMessage: parsed.data.message,
        ...(parsed.data.customerEmail ? { customerEmail: parsed.data.customerEmail } : {}),
      },
    },
  });

  return NextResponse.json({ taskId: task.id });
}
