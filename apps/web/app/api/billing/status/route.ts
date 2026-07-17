import { NextResponse } from "next/server";
import { prisma } from "@adventure/db";
import { getUser } from "@/lib/auth";

/** Current plan + subscription state for the billing page. */
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  const company = await prisma.company.findUnique({
    where: { slug },
    include: { subscription: true },
  });
  if (!company || company.ownerId !== user.id) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // An expired free/paid trial may not yet be flipped to LAPSED (the worker does
  // that on its 60s tick). Surface the expiry so the billing UI can prompt for a
  // plan immediately instead of showing a stale "active trial" card.
  const trialExpired =
    company.planTier === "TRIAL" &&
    !!company.trialEndsAt &&
    company.trialEndsAt < new Date();

  return NextResponse.json({
    planTier: company.planTier,
    companyStatus: company.status,
    subscriptionStatus: company.subscription?.status ?? null,
    currentPeriodEnd: company.subscription?.currentPeriodEnd ?? null,
    trialEndsAt: company.trialEndsAt ?? null,
    trialExpired,
  });
}
