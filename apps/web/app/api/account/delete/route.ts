import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import * as razorpay from "@adventure/core/razorpay";
import { getUser } from "@/lib/auth";

export const maxDuration = 120;

/**
 * DPDP right to erasure: permanently delete the account — every company, all
 * agent output, billing records, and the auth user itself. Active Razorpay
 * subscriptions are cancelled first (best-effort). Irreversible.
 */
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const companies = await prisma.company.findMany({
    where: { ownerId: user.id },
    select: { id: true, subscription: { select: { status: true, razorpaySubscriptionId: true } } },
  });

  // 1. Stop billing before the rows disappear.
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

  // 2. Wipe every company's data, then the companies, audits, and user row.
  const ids = companies.map((c) => c.id);
  await prisma.$transaction([
    prisma.approval.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.activityLog.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.memoryEntry.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.creditLedgerEntry.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.task.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.integration.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.provisionRecord.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.landingPage.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.dailyBrief.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.kpiSnapshot.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.transferRecord.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.llmUsageDay.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.dataExport.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.companyPlan.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.agentState.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.subscription.deleteMany({ where: { companyId: { in: ids } } }),
    prisma.company.deleteMany({ where: { id: { in: ids } } }),
    prisma.businessAudit.deleteMany({ where: { userId: user.id } }),
    prisma.deletedCompanySlot.deleteMany({ where: { ownerId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  // 3. Remove the Supabase auth user so the login itself is gone.
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    });
    if (!res.ok) console.error("[account/delete] auth user delete failed:", res.status);
  } else {
    console.error("[account/delete] SUPABASE_SERVICE_ROLE_KEY not set — auth user not removed");
  }

  return NextResponse.json({ ok: true });
}
