import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";

/**
 * Permanently delete a company. The web app cancels billing and marks the
 * company DELETING; the worker (which holds the platform GitHub/Vercel
 * tokens) tears down the live site and repo, then wipes every row.
 */
export async function DELETE(_request: Request, { params }: { params: { slug: string } }) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { slug: params.slug },
    include: { subscription: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
  if (company.status === "DELETING") return NextResponse.json({ ok: true });

  const sub = company.subscription;
  if (sub && sub.status !== "CANCELLED" && sub.razorpaySubscriptionId) {
    try {
      await razorpay.cancelSubscription(sub.razorpaySubscriptionId);
    } catch (err) {
      // Local deletion proceeds either way; the sub can't renew a deleted company.
      console.error("[companies/delete] razorpay cancel failed:", err);
    }
  }

  await prisma.$transaction([
    prisma.company.update({
      where: { id: company.id },
      data: { status: "DELETING", taskCyclesPerDay: 0 },
    }),
    // The freed slot only opens next month — record the tombstone now, since
    // the worker wipes the company rows shortly.
    prisma.deletedCompanySlot.create({
      data: { ownerId: user.id, name: company.name },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
