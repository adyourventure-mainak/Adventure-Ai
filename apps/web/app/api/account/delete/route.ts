import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";

export const maxDuration = 120;

/**
 * DPDP right to erasure. Three-step teardown:
 *   1. Here: cancel all subscriptions, mark every company DELETING, stamp
 *      User.deletedAt.
 *   2. Here: delete the Supabase auth user — the login dies immediately, so
 *      the account can't "resurrect" via getUser's upsert on next sign-in.
 *   3. Worker: tears down each company's live site + repo and wipes its rows,
 *      then removes the user row, audits, and slot tombstones.
 */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const companies = await prisma.company.findMany({
    where: { ownerId: user.id },
    select: { id: true, subscription: { select: { status: true, razorpaySubscriptionId: true } } },
  });

  // 1. Stop billing, hand companies to the worker's teardown.
  for (const c of companies) {
    const sub = c.subscription;
    if (sub && sub.status !== "CANCELLED" && sub.razorpaySubscriptionId) {
      try {
        await razorpay.cancelSubscription(sub.razorpaySubscriptionId);
      } catch (err) {
        console.error("[account/delete] razorpay cancel failed:", err);
      }
    }
  }
  await prisma.$transaction([
    prisma.company.updateMany({
      where: { ownerId: user.id },
      data: { status: "DELETING", taskCyclesPerDay: 0 },
    }),
    prisma.user.update({ where: { id: user.id }, data: { deletedAt: new Date() } }),
  ]);

  // 2. Kill the login itself. Without this the account recreates on sign-in.
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (!res.ok && res.status !== 404) {
      console.error("[account/delete] auth user delete failed:", res.status, await res.text().catch(() => ""));
      // The worker retries auth deletion during final cleanup.
    }
  }

  return NextResponse.json({ ok: true });
}
